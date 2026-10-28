import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { validateEditorDocument } from "@/domains/slideshow/editor/document";
import type { EditorDocument, ElementStyle } from "@/domains/slideshow/editor/types";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { ProductionStore } from "../../persistence/store";
import { cloneTaskProject } from "../layout";
import { seedLayoutSource } from "./fixtures";

function productionTask(store: ProductionStore, sourceProjectId: string) {
  const [id] = store.create([{mode:"past_post",sourceProjectId,instructions:""}],[]);
  store.state(id,"running");
  store.completeAnalysis(id,{
    analysis:"Use the original countdown format for a new exercise topic.",
    reasoning:{observations:[],interpretations:[],candidates:[]},
    topic:"Chest exercises",message:"Compare chest exercises",content_type:"Exercise countdown",
    answer:"Rank exercises",presentation:"One exercise per slide",reason:"Useful comparison",
    expected_response:"Save",goal_connection:"Follow",difference_from_recent:"New exercise group",sources:[],
  });
  store.state(id,"running");
  return id;
}
test("past-post production normalizes legacy definitions and local fonts without modifying the saved source",()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),projects=new ContentProjectStore(db);
  let cloneId:string|undefined;
  try {
    const source=seedLayoutSource(db,"legacy-layout-source");
    const saved=projects.get(source.project_id)!;
    const document=saved.document as EditorDocument;
    const title=makeElementDefinition({id:"title",kind:"text"});
    Object.assign(title.style,{fontFamily:"sans-serif"});
    delete (title.style as Partial<ElementStyle>).lineHeight;
    Object.assign(document.elements[0].style,{fontFamily:"sans-serif"});
    document.elements.push(title);
    document.slides[0].placements.push({id:"title-1",elementId:"title",value:"OLD TOPIC",frameOverride:{x:0.1,y:0.1,width:0.8,height:0.2},styleOverride:null});
    Object.assign(document.slides[0].placements.at(-1)!,{styleOverride:{fontFamily:"anton",fontWeight:700}});
    projects.save({...saved,document});
    const before=projects.get(source.project_id)!;
    assert.ok(validateEditorDocument(document).length>0);
    const id=productionTask(store,source.project_id);
    cloneId=cloneTaskProject(store,id,source.project_id,"Preserve the original countdown layout").projectId;
    const cloned=projects.get(cloneId)!.document as EditorDocument;
    assert.deepEqual(validateEditorDocument(cloned),[]);
    assert.equal(cloned.elements.find(element=>element.id==='title')!.style.fontFamily,'inter');
    assert.equal(cloned.elements.find(element=>element.id==='title')!.style.lineHeight,1.2);
    assert.equal(cloned.slides[0].placements.at(-1)!.styleOverride?.fontFamily,'oswald');
    assert.equal(cloned.slides[0].placements.at(-1)!.value,'');
    assert.deepEqual(cloned.slides[0].placements.at(-1)!.frameOverride,{x:0.1,y:0.1,width:0.8,height:0.2});
    assert.deepEqual(projects.get(source.project_id),before);
    assert.equal(store.get(id).task.project_id,cloneId);
  } finally {if(cloneId)contentJobRegistry.remove(cloneId);db.close();}
});
test("compatibility handling still rejects unsupported styles before linking a draft project",()=>{
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),projects=new ContentProjectStore(db);
  try {
    const source=seedLayoutSource(db,"invalid-layout-source");
    const saved=projects.get(source.project_id)!;
    const document=saved.document as EditorDocument;
    Object.assign(document.elements[0].style,{fontFamily:"unrecognized-font"});
    projects.save({...saved,document});
    const id=productionTask(store,source.project_id);
    assert.throws(()=>cloneTaskProject(store,id,source.project_id,"Use selected layout"),{code:"LAYOUT_SOURCE_INVALID"});
    assert.equal(store.get(id).task.project_id,null);
    assert.equal(projects.list().length,1);
  } finally {db.close();}
});
