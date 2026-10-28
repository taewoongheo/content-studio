import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { addReferenceAccount } from "../library";
import { refreshSpy } from "./refresh";
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
  const one=refreshSpy(db,client),two=refreshSpy(db,client);assert.equal(one,two);await one;
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
