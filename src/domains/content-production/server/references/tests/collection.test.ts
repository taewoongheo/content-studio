import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";
import { collectReferenceAccount } from "../collection";
import { accountIdentity, addReferenceAccount, externalReferences, setReferenceExcluded } from "../library";

test("registered account collection is shared, cached, stores images once and never resurrects exclusions",async()=>{
 const db=openLocalDatabase(":memory:");let calls=0,images=0;
 const client=new ApifyAccountPostsClient("key",async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,10));return Response.json([
  {id:"123",webVideoUrl:"https://www.tiktok.com/@example/photo/123",text:"An arm workout",slideshowImageLinks:["https://p.tiktokcdn.com/a","https://p.tiktokcdn.com/b"],playCount:100,diggCount:10,commentCount:1,collectCount:2}
 ]);});
 const capture=async()=>{images++;return [{data:Buffer.from("image"),width:1,height:1}];};
 try{
  await assert.rejects(()=>collectReferenceAccount(db,"example",false,client,capture),/지정 계정/);
  addReferenceAccount(db,"@example");
  await Promise.all([collectReferenceAccount(db,"example",false,client,capture),collectReferenceAccount(db,"example",false,client,capture)]);
  assert.equal(calls,1);assert.equal(images,1);assert.equal(externalReferences(db).length,1);
  await collectReferenceAccount(db,"example",false,client,capture);assert.equal(calls,1);
  setReferenceExcluded(db,"123",true);
  await collectReferenceAccount(db,"example",true,client,capture);assert.equal(calls,2);assert.equal(externalReferences(db).length,0);assert.equal(images,1);
  assert.equal(externalReferences(db,"","",true).length,1);
  assert.equal((db.prepare("SELECT count(*) n FROM content_visual_slides").get() as {n:number}).n,1);
 }finally{db.close();}
});
test("account registration accepts handles/URLs and rejects non-TikTok or unsafe URLs",()=>{
 assert.equal(accountIdentity("bluebro.fit").username,"bluebro.fit");assert.equal(accountIdentity("https://www.tiktok.com/@obsidian.form5").username,"obsidian.form5");
 assert.throws(()=>accountIdentity("https://instagram.com/example"));assert.throws(()=>accountIdentity("https://localhost/example"));
});
