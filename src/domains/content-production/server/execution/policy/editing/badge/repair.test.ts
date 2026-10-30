import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { badgeRepairCommands } from "./repair";

test("badge repair restores the selected brand and placement without inventing a global brand", async () => {
  const db=openLocalDatabase(":memory:"), registry=new ContentJobRegistry(), writes=new SlideshowProjectWrites(registry,db);
  try {
    const project=writes.create({name:"Origin",topic:"Travel",message:"Explore",content_type:"Guide",slideCount:1});
    const slideId=project.editor.document.slides[0].id;
    const badge=makeElementDefinition({id:"brand",kind:"text",role:"badge"});
    const saved=await writes.edit(project.id,[{type:"add_element",element:badge},{type:"place_element",slideId,elementId:"brand",placementId:"brand-placement"},
      {type:"set_slot_value",slideId,placementId:"brand-placement",value:"OTHER BRAND"},
      {type:"update_visual",scope:"local",slideId,placementId:"brand-placement",frame:{x:0.2,y:0.8,width:0.3,height:0.1}}],project.editor.revision,project.tabId);
    const source=structuredClone(saved.editor.document);
    source.slides[0].placements.sort((a,b) => Number(source.elements.find(e=>e.id===a.elementId)?.kind === "background") - Number(source.elements.find(e=>e.id===b.elementId)?.kind === "background"));
    assert.deepEqual(badgeRepairCommands(source,source),[]);
    const damaged=await writes.edit(project.id,[{type:"remove_placement",slideId,placementId:"brand-placement"}],saved.editor.revision,project.tabId);
    const repaired=await writes.edit(project.id,badgeRepairCommands(damaged.editor.document,source),damaged.editor.revision,project.tabId);
    assert.deepEqual(repaired.editor.document,source);
    assert.equal(repaired.savedRevision,repaired.editor.revision);
    assert.deepEqual(badgeRepairCommands(repaired.editor.document,source),[]);
    const changed=structuredClone(source);
    const image=makeElementDefinition({id:"art",kind:"image"});
    source.elements.push(image); changed.elements.push(image);
    source.slides[0].placements.unshift({id:"old-image",elementId:"art",value:"",frameOverride:null,styleOverride:null});
    changed.slides[0].placements.unshift({id:"new-image",elementId:"art",value:"",frameOverride:null,styleOverride:null});
    changed.slides.push({...structuredClone(changed.slides[0]),id:"added-slide"});
    assert.deepEqual(badgeRepairCommands(changed,source),[]);
    changed.slides[0].placements.find(p=>p.elementId === "brand")!.value="DAMAGED";
    // Apply the repair through the real command/write boundary, then ensure it is idempotent.
    const added=await writes.edit(project.id,[{type:"add_slide",afterSlideId:slideId,sourceSlideId:slideId,newSlideId:"added-slide",copyContent:true}],repaired.editor.revision,project.tabId);
    const fixed=await writes.edit(project.id,badgeRepairCommands(added.editor.document,source),added.editor.revision,project.tabId);
    assert.deepEqual(badgeRepairCommands(fixed.editor.document,source),[]);
    const noBadge=structuredClone(source);noBadge.elements=noBadge.elements.filter(e=>e.id!=="brand");
    assert.deepEqual(badgeRepairCommands(source,noBadge),[]);
  } finally {db.close();}
});
