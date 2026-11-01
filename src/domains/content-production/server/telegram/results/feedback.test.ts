import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { ProductionStore } from "../../persistence/store";
import { TelegramStore } from "../store";
import { TelegramClient } from "../client";
import { TelegramJobs } from "../commands/jobs";
import { ResultDelivery } from "./delivery";
import { TelegramFeedback } from "./feedback";
import type { AssistantState } from "@/domains/workspace/assistant/model";
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
function fixture(){
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"test"),client=new TelegramClient("unused");
  const writes=new SlideshowProjectWrites(new ContentJobRegistry(),db);
  const project=writes.create({name:"Final",topic:"Topic",message:"Message",content_type:"Guide",slideCount:1});
  const [id]=store.create(1);
  db.prepare("UPDATE content_drafts SET state='finished',project_id=? WHERE id=?").run(project.id,id);
  client.send=async()=>{};
  return {db,store,state,client,id,project,delivery:new ResultDelivery(client,state,"1","local",()=>store)};
}
test("UI-created finished drafts deliver automatically once, independently of copy failure and restart",async()=>{
  const f=fixture();let images=0,copies=0,warning="";
  f.delivery.images=async(_target,sent,progress)=>{assert.equal(sent,0);images++;progress?.(1);};
  f.delivery.copy=async()=>{copies++;throw new Error("CLI offline");};
  f.client.send=async(_chat,text)=>{warning=text;};
  const jobs=()=>new TelegramJobs(f.client,f.state,"1","local",{store:()=>f.store,stop(){}},{resume:async()=>{},reset(){}},f.delivery);
  try{
    await jobs().notify();await tick();
    assert.equal(f.store.get(f.id).task.state,"finished");
    assert.equal(images,1);assert.equal(copies,1);assert.match(warning,/문구/);
    await jobs().notify();await tick();assert.equal(images,1);
  }finally{f.db.close();}
});
test("feedback serializes commands, reads fresh state for each edit and resends every image plus requested copy",async()=>{
  const f=fixture();const reads:number[]=[],sent:string[]=[];let revision=0;
  let status:AssistantState={state:"idle",phase:"",text:"",suggestion:"",error:"",changed:false};
  f.delivery.images=async()=>{sent.push("all images");};f.delivery.text=async(_target,text)=>{sent.push(text);};
  const feedback=new TelegramFeedback(f.delivery,f.client,f.state,"1","local",()=>f.store,{
    load:async projectId=>{reads.push(revision);return {projectId,tabId:"tab",projectType:"slideshow"};},
    start:()=>{status={...status,state:"completed",changed:true,text:`copy ${++revision}`};return status;},
    status:()=>status,stop(){},
  });
  try{
    const target={projectId:f.project.id,draftId:f.id,number:1};
    feedback.request(target,"수정하고 문구도 줘","1");feedback.request(target,"다시 수정","2");
    for(let i=0;i<100 && f.state.get("feedback:2")!=="completed";i++)await tick();
    assert.deepEqual(reads,[0,1]);assert.deepEqual(sent,["all images","copy 1","all images","copy 2"]);
    f.delivery.copy=async()=>{assert.equal(revision,2);return "Title · Caption · #tag";};
    feedback.request(target,"","copy-only",undefined,"copy");
    for(let i=0;i<100 && f.state.get("feedback:copy-only")!=="completed";i++)await tick();
    assert.equal(sent.at(-1),"Title · Caption · #tag");assert.equal(revision,2);
    assert.deepEqual(reads,[0,1],"copy must not start the editing assistant");
    feedback.request(target,"duplicate","2");await tick();assert.equal(revision,2);
    assert.throws(()=>feedback.request({projectId:f.project.id},"수정","3"),/조회만/);
    f.store.remove(f.id);assert.throws(()=>feedback.request(target,"수정","4"));
  }finally{f.db.close();}
});
