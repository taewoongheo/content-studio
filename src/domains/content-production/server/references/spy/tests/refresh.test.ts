import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { addReferenceAccount } from "../../library";
import { refreshSpy, SPY_REFRESH_INTERVAL_MS } from "../refresh";
import type { SpyPost } from "@/domains/research/server/apify/spy-posts";
const post=(account:string,id:string):SpyPost=>({account,id,url:`https://www.tiktok.com/@${account}/video/${id}`,text:"Caption",published_at:"2026-10-28T00:00:00Z",images:[],view_count:100,like_count:10,comment_count:1,save_count:2,share_count:0});
test("initial metadata collection is batched; subsequent rounds drop completed accounts and share concurrent calls",async()=>{
 const db=openLocalDatabase(":memory:");
 try{
  ['a','b','c'].forEach(name=>addReferenceAccount(db,name));
  const calls: [string[],number][]=[];
  const initial={posts:async(names:string[],limit:number)=>{calls.push([names,limit]);return new Map(names.map((name,i)=>[name,[post(name,String(i))]]));}};
  await refreshSpy(db,initial);assert.deepEqual(calls,[[['a','b','c'],100]]);
  assert.equal((db.prepare("SELECT count(*) n FROM content_visual_sets").get() as {n:number}).n,0);
  calls.length=0;
  const client={posts:async(names:string[],limit:number)=>{calls.push([names,limit]);return new Map(names.map(name=>[name,name==='a'?[post('a','0')]:name==='b'?[post('b','20'),...(limit>1?[post('b','1')]:[])]:limit===1?[post('c','30')]:limit===3?[post('c','30'),post('c','31'),post('c','32')]:[post('c','30'),post('c','31'),post('c','32'),post('c','2')]]));}};
  const one=refreshSpy(db,client,undefined,{force:true}),two=refreshSpy(db,client,undefined,{force:true});assert.equal(one,two);await one;
  assert.deepEqual(calls,[[['a','b','c'],1],[['b','c'],3],[['c'],10]]);
  assert.equal((db.prepare("SELECT count(*) n FROM content_external_references").get() as {n:number}).n,7);
 }finally{db.close();}
});
test("failed collection preserves checkpoint and existing rows",async()=>{
 const db=openLocalDatabase(":memory:");
 try{
  addReferenceAccount(db,'a');db.prepare("UPDATE content_reference_accounts SET last_fetched_at='before'").run();
  const result=await refreshSpy(db,{posts:async()=>{throw Error('unavailable');}});
  assert.equal(result.accounts.a.state,'failed');
  assert.equal((db.prepare("SELECT last_fetched_at FROM content_reference_accounts").get() as {last_fetched_at:string}).last_fetched_at,'before');
 }finally{db.close();}
});
test("a full refresh joining account registration also checks the other registered accounts",async()=>{
 const db=openLocalDatabase(":memory:");
 try{
  ['a','b'].forEach(name=>addReferenceAccount(db,name));
  const calls:string[][]=[];
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
  const client={posts:async(names:string[])=>{calls.push(names);await gate;return new Map(names.map((name)=>[name,[post(name,name==='a'?'1':'2')]]));}};
  const registration=refreshSpy(db,client,['a']);
  const all=refreshSpy(db,client);release();await registration;const status=await all;
  assert.deepEqual(calls,[['a'],['b']]);assert.equal(status.accounts.a.state,'completed');assert.equal(status.accounts.b.state,'completed');
 }finally{db.close();}
});

test("new-post checks preserve existing snapshots and metadata, including on manual refresh", async () => {
 const db=openLocalDatabase(":memory:"), start=Date.parse('2026-11-01T00:00:00Z');
 try {
  addReferenceAccount(db,'a');
  await refreshSpy(db,{posts:async()=>new Map([['a',[post('a','1')]]])},undefined,{now:start});
  db.prepare("UPDATE content_external_references SET title='Reviewed title',topic='Reviewed topic' WHERE id='1'").run();
  assert.ok(!(db.prepare("PRAGMA table_info(content_external_references)").all() as {name:string}[]).some(row=>["view_count","like_count","comment_count","save_count","share_count"].includes(row.name)));
  const original=db.prepare("SELECT * FROM content_external_references WHERE id='1'").get();
  const calls:number[]=[];
  const changed={...post('a','1'),text:'Changed caption',view_count:99999,like_count:999,images:['https://example.com/changed.jpg']};
  const client={posts:async(_names:string[],limit:number)=>{
   calls.push(limit);
   return new Map([['a',limit===1?[post('a','2')]:[post('a','2'),changed]]]);
  }};
  await refreshSpy(db,client,undefined,{force:true,now:start+1000});
  assert.deepEqual(calls,[1,3], 'stop after reaching a saved post; no full-history metric refresh');
  assert.deepEqual(db.prepare("SELECT * FROM content_external_references WHERE id='1'").get(),original);
  assert.equal(db.prepare("SELECT caption FROM content_external_references WHERE id='2'").pluck().get(),"Caption");
  assert.equal((db.prepare("SELECT last_fetched_at FROM content_reference_accounts WHERE username='a'").get() as {last_fetched_at:string}).last_fetched_at,new Date(start+1000).toISOString());
  await refreshSpy(db,{posts:async()=>new Map([['a',[{...post('a','2'),view_count:555}]]])},undefined,{now:start+SPY_REFRESH_INTERVAL_MS+1000});
  assert.equal(db.prepare("SELECT caption FROM content_external_references WHERE id='2'").pluck().get(),"Caption");
 } finally { db.close(); }
});

test("automatic checks respect the persisted 12-hour checkpoint and never fetch disabled accounts",async()=>{
 const db=openLocalDatabase(":memory:"), start=Date.parse('2026-11-01T00:00:00Z');
 try {
  ['fresh','stale','disabled','new'].forEach(name=>addReferenceAccount(db,name));
  db.prepare("UPDATE content_reference_accounts SET enabled=0 WHERE username='disabled'").run();
  db.prepare("UPDATE content_reference_accounts SET last_fetched_at=? WHERE username='fresh'").run(new Date(start).toISOString());
  db.prepare("UPDATE content_reference_accounts SET last_fetched_at=? WHERE username='stale'").run(new Date(start-SPY_REFRESH_INTERVAL_MS).toISOString());
  const calls:[string[],number][]=[];
  const client={posts:async(names:string[],limit:number)=>{calls.push([names,limit]);return new Map(names.map(name=>[name,[post(name,name)]]));}};
  await refreshSpy(db,client,undefined,{now:start});
  assert.deepEqual(calls,[[['new'],100],[['stale'],1],[['stale'],3]]);
  calls.length=0;
  await refreshSpy(db,client,undefined,{now:start+SPY_REFRESH_INTERVAL_MS-1});
  assert.deepEqual(calls,[]);
  await refreshSpy(db,client,undefined,{now:start+SPY_REFRESH_INTERVAL_MS});
  assert.deepEqual(calls,[[['fresh','new','stale'],1],[['fresh'],3]]);
  calls.length=0;
  await refreshSpy(db,client,undefined,{now:start+SPY_REFRESH_INTERVAL_MS+1,force:true});
  assert.deepEqual(calls,[[['fresh','new','stale'],1]]);
 } finally { db.close(); }
});

test("an account disabled during collection cannot save incoming posts or advance its checkpoint",async()=>{
 const db=openLocalDatabase(":memory:");
 try {
  addReferenceAccount(db,'a');
  await refreshSpy(db,{posts:async()=>{
   db.prepare("UPDATE content_reference_accounts SET enabled=0 WHERE username='a'").run();
   return new Map([['a',[post('a','1')]]]);
  }});
  assert.equal((db.prepare("SELECT count(*) n FROM content_external_references").get() as {n:number}).n,0);
  assert.equal((db.prepare("SELECT last_fetched_at FROM content_reference_accounts WHERE username='a'").get() as {last_fetched_at:null}).last_fetched_at,null);
 } finally { db.close(); }
});
