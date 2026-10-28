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
