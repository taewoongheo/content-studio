import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { ProductionStore } from "../../persistence/store";
import { draftNumber } from "../../persistence/draft-numbers";
import { TelegramStore } from "../store";
import { TelegramPublication } from "./publication";

function fixture(){
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot");
 const project=new SlideshowProjectWrites(new ContentJobRegistry(),db).create({name:"Final",topic:"Topic",message:"Message",content_type:"Guide",slideCount:1});
 const [id]=store.create(1);
 db.prepare("UPDATE content_drafts SET state='finished',project_id=? WHERE id=?").run(project.id,id);
 return {db,store,state,id,project,number:draftNumber(db,id),logId:store.get(id).task.log_id};
}
test("publish resolves the incremental number to the log and supports explicit retry after draft removal",async()=>{
 const f=fixture(),calls:string[]=[];
 const publication=new TelegramPublication(f.state,()=>f.store,async(db,logId,url)=>{
   assert.equal(logId,f.logId);calls.push(url);
   db.prepare("UPDATE content_creation_logs SET project_id=?,post_url=?,completed_at='now' WHERE id=?").run(f.project.id,url,logId);
   db.prepare("DELETE FROM content_drafts WHERE id=?").run(f.id);
   return {completed:true};
 });
 try{
   let accepted=0;
   for(let i=0;i<2;i++)assert.equal(await publication.publish(`${f.number} https://www.tiktok.com/@test/photo/123`,async()=>{accepted++;}),String(f.number));
   assert.equal(accepted,2);assert.equal(calls.length,2);assert.equal(f.store.list().length,0);
 }finally{f.db.close();}
});
test("failed collection preserves the draft; malformed, unfinished and busy requests do not register",async()=>{
 const f=fixture();let calls=0;
 const publication=new TelegramPublication(f.state,()=>f.store,async()=>{calls++;throw new Error("Apify failed");});
 try{
   await assert.rejects(()=>publication.publish(`${f.number} https://www.tiktok.com/@test/photo/123`,async()=>{}),/Apify/);
   assert.equal(f.store.get(f.id).task.state,"finished");assert.equal(calls,1);
   await assert.rejects(()=>publication.publish(`${f.number}`,async()=>{}),/publish/);
   f.store.state(f.id,"running");
   await assert.rejects(()=>publication.publish(`${f.number} https://example.com`,async()=>{}),/완료된/);
   f.store.state(f.id,"finished");
   const busy=new TelegramPublication(f.state,()=>f.store,async()=>{throw Error("must not call");},()=>true);
   await assert.rejects(()=>busy.publish(`${f.number} https://example.com`,async()=>{}),/수정 또는/);
   assert.equal(calls,1);
 }finally{f.db.close();}
});
