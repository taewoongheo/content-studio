import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ApifyTikTokClient } from "@/domains/research/server/apify/client";
import { ensureReferenceImages } from "../images";
function fixture() {
 const db=openLocalDatabase(":memory:");
 db.prepare("INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at) VALUES('123','https://www.tiktok.com/@a/photo/123','a','caption','now',?,'now')").run(JSON.stringify(['https://p.tiktokcdn.com/1','https://p.tiktokcdn.com/2']));
 return db;
}
test("selected image capture is shared and retained without another actor or download",async()=>{
 const db=fixture();let downloads=0;
 const client=new ApifyTikTokClient('key',async()=>{throw Error('must not call actor');});
 const capture=async(urls:string[])=>{downloads++;return urls.map(()=>({data:Buffer.from('image'),width:540,height:675}));};
 try{
  const a=ensureReferenceImages(db,'123',client,capture),b=ensureReferenceImages(db,'123',client,capture);
  assert.equal(a,b);const set=await a;assert.equal(downloads,1);
  assert.equal(await ensureReferenceImages(db,'123',client,capture),set);assert.equal(downloads,1);
  assert.equal((db.prepare('SELECT count(*) n FROM content_visual_slides').get() as {n:number}).n,2);
 }finally{db.close();}
});
test("expired image links refresh only the selected post; failed capture never saves a partial set",async()=>{
 const db=fixture();let calls=0,downloads=0;
 const client=new ApifyTikTokClient('key',async(_url,options)=>{calls++;assert.deepEqual(JSON.parse(String(options?.body)).postURLs,['https://www.tiktok.com/@a/photo/123']);return Response.json([{id:'123',slideshowImageLinks:['https://p.tiktokcdn.com/new1','https://p.tiktokcdn.com/new2']}]);});
 try{
  await assert.rejects(()=>ensureReferenceImages(db,'123',client,async()=>{downloads++;throw Error('unavailable');}),/unavailable/);
  assert.equal(calls,1);assert.equal(downloads,2);
  assert.equal((db.prepare('SELECT count(*) n FROM content_visual_sets').get() as {n:number}).n,0);
  assert.ok((db.prepare('SELECT image_error FROM content_external_references').get() as {image_error:string}).image_error);
 }finally{db.close();}
});

test("cancelling one consumer detaches promptly without cancelling another consumer's capture", async () => {
  const db = fixture();
  let complete!: (value: Array<{data:Buffer;width:number;height:number}>) => void;
  let sharedSignal!: AbortSignal;
  const capture = (_urls: string[], signal?: AbortSignal) => {
    sharedSignal = signal!;
    return new Promise<Array<{data:Buffer;width:number;height:number}>>(resolve => { complete = resolve; });
  };
  const client = { posts: async () => { throw Error("unexpected actor call"); } };
  const first = new AbortController(), second = new AbortController();
  try {
    const a = ensureReferenceImages(db, "123", client, capture, first.signal);
    const b = ensureReferenceImages(db, "123", client, capture, second.signal);
    first.abort();
    await assert.rejects(a, { name: "AbortError" });
    assert.equal(sharedSignal.aborted, false);
    complete([0,1].map(() => ({data:Buffer.from("image"),width:540,height:675})));
    const set = await b;
    assert.ok(set);
    assert.equal(await ensureReferenceImages(db, "123", client, capture), set);
  } finally { db.close(); }
});

test("last consumer cancellation aborts actor work, saves no error, and allows a fresh retry", async () => {
  const db = fixture(), controller = new AbortController();
  let actorStarted!: () => void;
  const started = new Promise<void>(resolve => { actorStarted = resolve; });
  let actorSignal!: AbortSignal;
  const client = { posts: async (_urls: string[], signal?: AbortSignal) => {
    actorSignal = signal!; actorStarted();
    return new Promise<never>((_resolve, reject) => signal!.addEventListener("abort", () => reject(signal!.reason), {once:true}));
  } };
  try {
    const work = ensureReferenceImages(db, "123", client, async () => { throw Error("expired image"); }, controller.signal);
    await started;
    controller.abort();
    await assert.rejects(work, { name: "AbortError" });
    assert.equal(actorSignal.aborted, true);
    const set = await ensureReferenceImages(db, "123", client, async urls => urls.map(() => ({data:Buffer.from("image"),width:540,height:675})));
    assert.ok(set);
    assert.equal((db.prepare("SELECT image_error FROM content_external_references").get() as {image_error:unknown}).image_error, null);
  } finally { db.close(); }
});
