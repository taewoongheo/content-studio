import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { ProductionStore } from "../../persistence/store";
import { cloneTaskProject } from "../layout";
import { createTaskProject } from "../creation";
import { seedLayoutSource } from "./fixtures";

const direction={analysis: "A routine comparison.", reasoning: { observations: [], interpretations: [], candidates: [] },topic:"New content",message:"A new session",content_type:"Routine cards",answer:"Five moves",presentation:"Cards",reason:"Useful",expected_response:"Save",goal_connection:"Follow",difference_from_recent:"Different content",sources:[]};

test("cloning uses only the explicitly selected saved layout, clears old copy/images, preserves styles and source",()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),projects=new ContentProjectStore(db);
  const source=seedLayoutSource(db,"layout-source");
  let cloneId:string|undefined;
  try{
    const original=projects.get(source.project_id)!;
    const document=original.document as EditorDocument;
    document.aspectRatio="9:16";
    document.elements.push(makeElementDefinition({id:"title",kind:"text"}),makeElementDefinition({id:"image",kind:"image"}));
    document.elements.find(element=>element.id==="title")!.style.fontSize=72;
    document.slides[0].placements.push(
      {id:"title",elementId:"title",value:"OLD TOPIC",frameOverride:{x:0.07,y:0.1,width:0.8,height:0.2},styleOverride:null,textColors:[{start:0,end:3,color:"#FF0000"}]},
      {id:"badge",elementId:"title",value:"LIFTCODE",frameOverride:null,styleOverride:{fontSize:25}},
      {id:"image",elementId:"image",value:"source-image",frameOverride:{x:0.1,y:0.3,width:0.8,height:0.5},styleOverride:null},
    );
    projects.save({...original,aspectRatio:"9:16",document,assets:[{assetId:"source-image",name:"Original",type:"image/png",bytes:Buffer.from([1,2,3])}]});
    const before=projects.get(source.project_id);
    loadContentProject(contentJobRegistry,source.project_id,{projects});
    contentJobRegistry.update(source.project_id,record=>{record.editor.document.elements.find(element=>element.id==="title")!.style.fontSize=999;});
    const [id]=store.create([{mode:"past_post",sourceProjectId:source.project_id,instructions:""}],[]);store.state(id,"running");store.completeAnalysis(id,direction);store.state(id,"running");
    const outside=seedLayoutSource(db,"unassigned-source");
    assert.throws(()=>cloneTaskProject(store,id,outside.project_id,"Wrong pool"),{code:"LAYOUT_SOURCE_NOT_SELECTED"});
    assert.equal(store.get(id).task.project_id,null);
    const cloned=cloneTaskProject(store,id,source.project_id,"The source has clear hierarchy and enough image space.");cloneId=cloned.projectId;
    const target=projects.get(cloned.projectId)!;
    const copy=target.document as EditorDocument;
    assert.equal(target.aspectRatio,"4:5");
    assert.equal(copy.aspectRatio,"4:5");
    assert.equal((before!.document as EditorDocument).aspectRatio,"9:16");
    assert.equal(copy.elements.find(element=>element.id==="title")!.style.fontSize,72,"must use DB, not the open unsaved source");
    assert.deepEqual(copy.slides[0].placements.find(item=>item.id==="title")!.frameOverride,document.slides[0].placements.find(item=>item.id==="title")!.frameOverride);
    assert.equal(copy.slides[0].placements.find(item=>item.id==="title")!.value,"");
    assert.equal(copy.slides[0].placements.find(item=>item.id==="title")!.textColors,undefined);
    assert.equal(copy.slides[0].placements.find(item=>item.id==="badge")!.value,"LIFTCODE");
    assert.equal(copy.slides[0].placements.find(item=>item.id==="image")!.value,"");
    assert.deepEqual(target.assets,[]);assert.deepEqual(contentJobRegistry.getRecord(cloned.projectId).imageData,{});
    assert.equal(target.topic,direction.topic);
    assert.deepEqual(projects.get(source.project_id),before);
    assert.equal((store.get(id).production?.sources as Array<{id:string}>)[0].id,source.id);
    assert.equal(cloneTaskProject(store,id,outside.project_id,"Resume existing").projectId,cloned.projectId);
  }finally{if(cloneId)contentJobRegistry.remove(cloneId);contentJobRegistry.remove(source.project_id);db.close();}
});

test("failed clone creation rolls back the draft, DB project and open editor together",()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  try{
    const source=seedLayoutSource(db,"rollback-layout");
    const [id]=store.create([{mode:"past_post",sourceProjectId:source.project_id,instructions:""}],[]);store.state(id,"running");store.completeAnalysis(id,direction);store.state(id,"running");
    const before=store.get(id),openBefore=contentJobRegistry.list().map(job=>job.id);
    db.exec("CREATE TRIGGER prevent_layout_link BEFORE UPDATE OF project_id ON content_drafts BEGIN SELECT RAISE(ABORT,'link failed'); END;");
    assert.throws(()=>cloneTaskProject(store,id,source.project_id,"Suitable card structure"),/link failed/);
    assert.deepEqual(store.get(id),before);
    assert.deepEqual(contentJobRegistry.list().map(job=>job.id),openBefore);
    assert.equal((db.prepare("SELECT count(*) n FROM content_projects").get() as {n:number}).n,1);
    assert.deepEqual(db.pragma("foreign_key_check"),[]);
  }finally{db.close();}
});

test("automatic and external requests start blank, link atomically and reuse their project on resume", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db), projects = new ContentProjectStore(db);
  const created: string[] = [];
  try {
    for (const mode of ["automatic", "external_url"] as const) {
      const request = mode === "automatic" ? { mode, instructions: "" } : { mode, url: "https://www.tiktok.com/@example/photo/123", instructions: "" };
      const [id] = store.create([request], []);
      store.state(id, "running"); store.completeAnalysis(id, direction); store.state(id, "running");
      const result = createTaskProject(store, id, 4); created.push(result.projectId);
      assert.equal(store.get(id).task.project_id, result.projectId);
      const document = projects.get(result.projectId)!.document as EditorDocument;
      assert.equal(document.slides.length, 4);
      assert.equal(document.aspectRatio, "4:5");
      assert.ok(document.slides.every(slide => slide.placements.every(placement => !placement.value)));
      assert.equal(createTaskProject(store, id, 8).projectId, result.projectId);
    }
    const [id] = store.create(1, []);
    store.state(id, "running"); store.completeAnalysis(id, direction); store.state(id, "running");
    const before = contentJobRegistry.list().length;
    db.exec("CREATE TRIGGER reject_blank_link BEFORE UPDATE OF project_id ON content_drafts BEGIN SELECT RAISE(ABORT,'blank link failed'); END;");
    assert.throws(() => createTaskProject(store, id, 4), /blank link failed/);
    assert.equal(store.get(id).task.project_id, null);
    assert.equal(contentJobRegistry.list().length, before);
    assert.equal(projects.list().length, 2);
  } finally { created.forEach(id => contentJobRegistry.remove(id)); db.close(); }
});
