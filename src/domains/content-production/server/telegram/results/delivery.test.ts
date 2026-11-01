import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { ProductionStore } from "../../persistence/store";
import { TelegramStore } from "../store";
import { TelegramClient } from "../client";
import { ResultDelivery } from "./delivery";

test("delivery batches all saved slides, pins the render snapshot, and persists reply targets across restart",async()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"test");
  const registry=new ContentJobRegistry(),writes=new SlideshowProjectWrites(registry,db);
  const project=writes.create({name:"Ready",topic:"Topic",message:"Message",content_type:"Guide",slideCount:11});
  const client=new TelegramClient("unused"),batches:number[]=[],ids:string[]=[];
  let message=100;
  client.photos=async(_chat,photos)=>{batches.push(photos.length);return photos.map(()=>({message_id:message++}));};
  const delivery=new ResultDelivery(client,state,"1","http://127.0.0.1:3000",()=>store,async(_origin,job,slides)=>{
    assert.equal(job.id,project.id);ids.push(...slides);
    return slides.map(slideId=>({slideId,bytes:Buffer.from("png")}));
  });
  try {
    await delivery.images({projectId:project.id});
    assert.deepEqual(batches,[10,1]);assert.equal(new Set(ids).size,11);
    const restarted=new TelegramStore(db,"test");
    assert.deepEqual(restarted.get("message:110"),{projectId:project.id,slideId:project.editor.document.slides[10].id});
    client.linkedText=async(_chat,text,link)=>{assert.equal(text,"copy");link(200);};
    await delivery.text({projectId:project.id},"copy");
    assert.deepEqual(restarted.get("message:200"),{projectId:project.id});
  } finally {db.close();}
});

test("copy generation reads current saved content with no editing capabilities or DB writes",async()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"test");
  const writes=new SlideshowProjectWrites(new ContentJobRegistry(),db);
  const project=writes.create({name:"Current",topic:"Topic",message:"Message",content_type:"Guide",slideCount:1});
  const delivery=new ResultDelivery(new TelegramClient("unused"),state,"1","local",()=>store,undefined,async input=>{
    assert.ok(input.standalone);assert.deepEqual(input.capabilities,{webSearch:false,shell:false,imageGeneration:false});
    assert.match(input.prompt,/Current|Topic/);return {text:"Title\nCaption\n#tag"};
  });
  try {
    const changes=db.prepare("SELECT total_changes() n").get();
    assert.match(await delivery.copy({projectId:project.id}),/Caption/);
    assert.deepEqual(db.prepare("SELECT total_changes() n").get(),changes);
  } finally {db.close();}
});
