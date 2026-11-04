import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { ProductionStore } from "../../persistence/store";
import { createTaskProject } from "../creation";
import { cloneTaskProject } from "../layout";
import { stageContext } from "../../execution/policy/context";
import { assertTaskSourceFormat, sourceDocument, type SourceFormat } from "../format/snapshot";
import { seedLayoutSource } from "./fixtures";

const direction={analysis: "A routine comparison.", reasoning: { observations: [], interpretations: [], candidates: [] },topic:"New content",message:"A new session",content_type:"Routine cards",answer:"Five moves",presentation:"Cards",reason:"Useful",expected_response:"Save",goal_connection:"Follow",difference_from_recent:"Different content",sources:[]};

test("cloning uses only the explicitly selected saved layout, preserves copy/assets, preserves styles and source",()=>{
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
    assert.equal(copy.slides[0].placements.find(item=>item.id==="title")!.value,"OLD TOPIC");
    assert.deepEqual(copy.slides[0].placements.find(item=>item.id==="title")!.textColors,[{start:0,end:3,color:"#FF0000"}]);
    assert.equal(copy.slides[0].placements.find(item=>item.id==="badge")!.value,"LIFTCODE");
    assert.equal(copy.slides[0].placements.find(item=>item.id==="image")!.value,"source-image");
    assert.equal(target.assets.length,1);assert.deepEqual(Buffer.from(contentJobRegistry.getRecord(cloned.projectId).imageData["source-image"]),Buffer.from([1,2,3]));
    assert.equal(target.topic,direction.topic);
    assert.deepEqual(projects.get(source.project_id),before);
    assert.equal((store.get(id).production?.sources as Array<{id:string}>)[0].id,source.project_id);
    assert.equal(cloneTaskProject(store,id,outside.project_id,"Resume existing").projectId,cloned.projectId);
    const frozen = structuredClone(store.get(id).analysis.source_format);
    const changedSource = projects.get(source.project_id)!;
    (changedSource.document as EditorDocument).slides.pop();
    projects.save(changedSource);
    store.save(id, "production", { content_review: { assessment: "Reviewed", issues: [] } });
    const resumed = new ProductionStore(db);
    assert.deepEqual(resumed.get(id).analysis.source_format, frozen);
    assert.deepEqual(sourceDocument(resumed, resumed.get(id)), (frozen as SourceFormat).document);
    assert.deepEqual(stageContext(resumed.get(id)).analysis.source_format, frozen);
    assert.doesNotThrow(() => assertTaskSourceFormat(resumed.get(id), copy));
    assert.equal(cloneTaskProject(resumed,id,source.project_id,"Resume").projectId,cloned.projectId);
    assert.deepEqual(resumed.get(id).analysis.source_format, frozen);
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

test("a failed format snapshot rolls back the already created clone and editor", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const source = seedLayoutSource(db, "snapshot-rollback");
    const [id] = store.create([{ mode: "past_post", sourceProjectId: source.project_id, instructions: "" }], []);
    store.state(id, "running"); store.completeAnalysis(id, direction); store.state(id, "running");
    const before = store.get(id), openBefore = contentJobRegistry.list().map(job => job.id);
    db.exec(`CREATE TRIGGER reject_snapshot BEFORE UPDATE ON content_stage_documents
      WHEN json_type(NEW.document_json, '$.source_format') IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'snapshot failed'); END;`);
    assert.throws(() => cloneTaskProject(store, id, source.project_id, "Source"), /snapshot failed/);
    assert.deepEqual(store.get(id), before);
    assert.deepEqual(contentJobRegistry.list().map(job => job.id), openBefore);
    assert.equal((db.prepare("SELECT count(*) n FROM content_projects").get() as { n: number }).n, 1);
  } finally { db.close(); }
});

test("older drafts acquire the original format on resume without overwriting their work", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  let projectId: string | undefined;
  try {
    const source = seedLayoutSource(db, "legacy-format");
    const [id] = store.create([{ mode: "past_post", sourceProjectId: source.project_id, instructions: "" }], []);
    store.state(id, "running"); store.completeAnalysis(id, direction); store.state(id, "running");
    projectId = cloneTaskProject(store, id, source.project_id, "Source").projectId;
    db.prepare("UPDATE content_stage_documents SET document_json=json_remove(document_json,'$.source_format') WHERE log_id=?")
      .run(store.get(id).task.log_id);
    const draft = contentJobRegistry.getRecord(projectId).editor.document;
    draft.slides.push({ ...structuredClone(draft.slides[0]), id: "old-extra-explanation" });
    assert.throws(() => assertTaskSourceFormat(store.get(id), draft), { code: "SOURCE_FORMAT_MISSING" });
    assert.equal(cloneTaskProject(store, id, source.project_id, "Resume").reused, true);
    assert.equal(draft.slides.length, 2, "resume must not discard existing edits");
    assert.throws(() => assertTaskSourceFormat(store.get(id), draft), { code: "SOURCE_FORMAT_MISMATCH" });
  } finally { if (projectId) contentJobRegistry.remove(projectId); db.close(); }
});

test("automatic requests clone the confirmed internal origin and retain it across resume",()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  const source=seedLayoutSource(db,"clone-origin"),other=seedLayoutSource(db,"other-origin");
  const created:string[]=[];
  try {
    for(const mode of ["automatic"] as const){
      const request=mode === "automatic" ? {mode,instructions:""} : {mode,url:"https://www.tiktok.com/@example/photo/123",instructions:""};
      const [id]=store.create([request],[source,other]);store.state(id,"running");
      store.completeAnalysis(id,{...direction,sources:[{kind:"log",id:source.id,clone_project_id:source.project_id,part:"Layout",used_for:"Preserve composition"}]});store.state(id,"running");
      assert.throws(()=>cloneTaskProject(store,id,other.project_id,"Wrong source"),{code:"LAYOUT_SOURCE_NOT_SELECTED"});
      const result=cloneTaskProject(store,id,source.project_id,"Approved origin");created.push(result.projectId);
      assert.equal(cloneTaskProject(store,id,source.project_id,"Resume").projectId,result.projectId);
      assert.equal((store.get(id).analysis.sources as Array<{clone_project_id:string}>)[0].clone_project_id,source.project_id);
    }
  } finally {created.forEach(id=>contentJobRegistry.remove(id));db.close();}
});


test("external blank creation needs no internal origin and preserves linked work on resume", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db), projects = new ContentProjectStore(db);
  let projectId: string | undefined;
  try {
    const [id] = store.create([{mode:"external_url",url:"https://www.tiktok.com/@example/photo/123",instructions:""}], []);
    store.state(id,"running"); store.completeAnalysis(id,direction); store.state(id,"running");
    assert.throws(() => cloneTaskProject(store,id,"any-internal","Clone"), {code:"PROJECT_CREATION_MODE"});
    const result = createTaskProject(store,id,7); projectId = result.projectId;
    const saved = projects.get(projectId)!;
    assert.equal(saved.aspectRatio,"4:5");
    assert.equal((saved.document as EditorDocument).slides.length,7);
    assert.equal((saved.document as EditorDocument).elements.filter(element => element.kind !== "background").length,0);
    assert.equal(saved.assets.length,0);
    assert.equal(saved.topic,direction.topic);
    assert.deepEqual(createTaskProject(store,id,3), {projectId,reused:true});
    assert.deepEqual(projects.get(projectId),saved);
    const [internal] = store.create([{mode:"automatic",instructions:""}], []);
    store.state(internal,"running");
    assert.throws(() => createTaskProject(store,internal,3), {code:"PROJECT_CREATION_MODE"});
  } finally { if(projectId) contentJobRegistry.remove(projectId); db.close(); }
});

test("blank creation rolls back project and registry if linking fails", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const [id] = store.create([{mode:"external_url",url:"https://www.tiktok.com/@example/photo/123",instructions:""}], []);
    store.state(id,"running"); store.completeAnalysis(id,direction); store.state(id,"running");
    const openBefore = contentJobRegistry.list().map(job => job.id);
    db.exec("CREATE TRIGGER prevent_blank_link BEFORE UPDATE OF project_id ON content_drafts BEGIN SELECT RAISE(ABORT,'link failed'); END;");
    assert.throws(() => createTaskProject(store,id,3), /link failed/);
    assert.equal(store.get(id).task.project_id,null);
    assert.deepEqual(contentJobRegistry.list().map(job => job.id),openBefore);
    assert.equal((db.prepare("SELECT count(*) n FROM content_projects").get() as {n:number}).n,0);
  } finally { db.close(); }
});
