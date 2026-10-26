import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import sharp from "sharp";
import {assertUniqueProjectImages} from "./unique";
import {openLocalDatabase} from "@/lib/local-db/database";
import {ContentJobRegistry} from "@/domains/slideshow/workflow/registry";
import {ContentProjectStore} from "@/domains/slideshow/server/persistence/projects/store";
import {createContentProject,saveContentProject} from "@/domains/slideshow/projects/service";
import {SlideshowProjectWrites} from "@/domains/slideshow/server/project-writes";
import {makeElementDefinition} from "@/domains/slideshow/editor/elements/factory";

test("duplicate image writes roll back DB, revision and newly registered assets across slides",async()=>{
  const db=openLocalDatabase(":memory:"),registry=new ContentJobRegistry();
  const directory=await mkdtemp(join(tmpdir(),"duplicate-image-test-"));
  const stores={projects:new ContentProjectStore(db)};
  const writes=new SlideshowProjectWrites(registry,db,assertUniqueProjectImages);
  try{
    const job=createContentProject(registry,{name:"Unique images",slideCount:2},stores);
    saveContentProject(registry,job.id,"Unique images",stores);
    const bytes=await sharp({create:{width:8,height:8,channels:4,background:"red"}}).webp({lossless:true}).toBuffer();
    const first=join(directory,"first.webp"),copy=join(directory,"renamed.webp");
    await writeFile(first,bytes);await writeFile(copy,bytes);
    const state=await writes.edit(job.id,[
      {type:"add_element",element:makeElementDefinition({id:"image",kind:"image"})},
      {type:"place_element",slideId:"slide-1",elementId:"image",placementId:"first"},
      {type:"set_local_image",slideId:"slide-1",placementId:"first",localPath:first},
    ],0,job.tabId);
    const saved=stores.projects.get(job.id),before=structuredClone(registry.getRecord(job.id).imageData);
    const duplicate=[{type:"place_element" as const,slideId:"slide-2",elementId:"image",placementId:"second"}];
    for(const command of [
      {type:"set_slot_value" as const,slideId:"slide-2",placementId:"second",value:state.assets[0].id},
      {type:"set_local_image" as const,slideId:"slide-2",placementId:"second",localPath:copy},
    ]){
      await assert.rejects(writes.edit(job.id,[...duplicate,command],state.editor.revision,job.tabId),{code:"DUPLICATE_PROJECT_IMAGE"});
      assert.deepEqual(registry.get(job.id),state);
      assert.deepEqual(registry.getRecord(job.id).imageData,before);
      assert.deepEqual(stores.projects.get(job.id),saved);
    }
    const distinct=join(directory,"new.webp");
    await writeFile(distinct,await sharp({create:{width:8,height:8,channels:4,background:"blue"}}).webp({lossless:true}).toBuffer());
    const next=await writes.edit(job.id,[...duplicate,{type:"set_local_image",slideId:"slide-2",placementId:"second",localPath:distinct}],state.editor.revision,job.tabId);
    assert.equal(next.assets.length,2);
  }finally{db.close();await rm(directory,{recursive:true,force:true});}
});
