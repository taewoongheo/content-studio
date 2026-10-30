import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { generatedImagesRoot } from "@/domains/content-production/server/images/generated";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "./route";
import { productionStore, execute } from "@/domains/content-production/server/execution/runner";

test("visual task route provides repair tools and preserves schema diagnostics", async () => {
  const directory=await mkdtemp(join(tmpdir(),"production-diagnostics-route-"));
  process.env.CONTENT_STUDIO_DB_PATH=join(directory,"test.sqlite");
  const store=productionStore();
  const imageThread=randomUUID();
  const imageRoot=join(generatedImagesRoot(),imageThread);
  try {
    const [id]=store.create(1);
    store.db.prepare("INSERT INTO content_visual_drafts(draft_id,created_at,updated_at) VALUES(?,'now','now')").run(id);
    store.db.prepare("UPDATE content_drafts SET current_step='visual' WHERE id=?").run(id);
    store.db.prepare("UPDATE content_analysis_drafts SET analysis=? WHERE draft_id=?").run("private-layout-source",id);
    const writes=new SlideshowProjectWrites(contentJobRegistry,store.db);
    const project=writes.create({name:"Repair",topic:"Machines",message:"Use machines",content_type:"Guide",slideCount:1});
    const slideId=project.editor.document.slides[0].id;
    await writes.edit(project.id,[
      {type:"add_element",element:makeElementDefinition({id:"copy",kind:"text"})},
      {type:"place_element",slideId,elementId:"copy",placementId:"copy"},
      {type:"add_element",element:makeElementDefinition({id:"image",kind:"image"})},
      {type:"place_element",slideId,elementId:"image",placementId:"image"},
    ],project.editor.revision,project.tabId);
    store.db.prepare("UPDATE content_drafts SET project_id=? WHERE id=?").run(project.id,id);
    let requestId=0;
    await execute(id,"http://127.0.0.1:3000",async input=>{
      if(input.standalone) return {};
      const call=async(name:string,args:Record<string,unknown>)=>{
        const response=await POST(new Request(`http://127.0.0.1:3000/api/content-production/agent/${id}`,{
          method:"POST",headers:{host:"127.0.0.1:3000",authorization:`Bearer ${input.token}`,"Content-Type":"application/json",Accept:"application/json, text/event-stream"},
          body:JSON.stringify({jsonrpc:"2.0",id:++requestId,method:"tools/call",params:{name,arguments:args}}),
        }),{params:Promise.resolve({taskId:id})});
        assert.equal(response.status,200);
        return (await response.json()).result;
      };
      input.onThreadStarted?.(imageThread);
      await mkdir(imageRoot,{recursive:true});
      const subject=await sharp({create:{width:4,height:4,channels:4,background:{r:80,g:90,b:100,alpha:1}}}).png().toBuffer();
      const imagePath=join(imageRoot,"repair.png");
      await writeFile(imagePath,await sharp({create:{width:8,height:8,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:subject,left:2,top:2}]).png().toBuffer());
      const latest=()=>contentJobRegistry.get(project.id);
      const imageResult=await call("production_use_generated_image",{slideId,placementId:"image",localPath:imagePath,expectedRevision:latest().editor.revision,expectedTabId:project.tabId});
      assert.ok(!imageResult.isError,JSON.stringify(imageResult));
      const edited=await call("edit_project",{projectId:project.id,expectedRevision:latest().editor.revision,expectedTabId:project.tabId,commands:[
        {type:"set_slot_value",slideId,placementId:"copy",value:"Correct machine instructions"},
        {type:"update_visual",scope:"local",slideId,placementId:"copy",frame:{x:0.1,y:0.1,width:0.8,height:0.2}},
      ]});
      assert.ok(!edited.isError,JSON.stringify(edited));
      assert.equal(latest().editor.document.slides[0].placements.find(p=>p.id==="copy")?.value,"Correct machine instructions");
      assert.equal(latest().savedRevision,latest().editor.revision);
      const rejected=await call("edit_project",{projectId:"another-project",expectedRevision:0,expectedTabId:project.tabId,commands:[]});
      assert.equal(rejected.isError,true);
      const conflict=await call("edit_project",{projectId:project.id,expectedRevision:0,expectedTabId:project.tabId,commands:[{type:"set_slot_value",slideId,placementId:"copy",value:"Stale"}]});
      assert.equal(conflict.structuredContent.error.code,"REVISION_CONFLICT");
      assert.equal((await call("production_external_references",{})).structuredContent.error.code,"TOOL_NOT_FOUND");
      assert.equal((await call("production_visual_references",{keywords:"wrong"})).structuredContent.error.code,"TOOL_NOT_FOUND");
      assert.equal((await call("production_save_draft",{patch:"wrong"})).structuredContent.error.code,"INVALID_INPUT");
      assert.notEqual((await call("production_preview_project",{projectId:"unselected"})).structuredContent.error.code,"TOOL_NOT_FOUND");
      const context = await call("production_context",{});
      assert.ok(!JSON.stringify(context).includes("private-layout-source"));
      return {}; // Deliberate final-output mismatch, distinct from the tool errors above.
    });
    const error=store.get(id).visual?.error as {code:string;phase:string;tool_calls:Array<{tool:string;code?:string;input:unknown}>};
    assert.equal(error.code,"OUTPUT_REPAIR_EXHAUSTED");assert.equal(error.phase,"output");
    assert.equal(error.tool_calls.length,9);
    assert.ok(error.tool_calls.some(call=>call.code==="INVALID_INPUT"));
    assert.ok(error.tool_calls.some(call=>call.code==="TOOL_NOT_FOUND"));
    assert.equal(store.get(id).task.state,"failed");
  } finally { store.db.close();await rm(directory,{recursive:true,force:true});await rm(imageRoot,{recursive:true,force:true}); }
});
