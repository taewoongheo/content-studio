import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { queryStageReferences, referenceImagesAllowed } from "../selection";
import { getReferenceContext } from "../context";
import { addReferenceAccount, setReferenceExcluded, describeReference, externalReferences } from "../library";
const input={query:"",content_type:"",collect:false};
function seed(db:ReturnType<typeof openLocalDatabase>,count=12) {
  for(let i=0;i<count;i++)db.prepare("INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at,view_count,like_count,comment_count,save_count) VALUES(?,?, 'example',?,'now','[]','now',100,?,1,2)")
    .run(String(i),`https://www.tiktok.com/@example/photo/${i}`,i<4?"Arm workout":"Back workout",i);
}
const direction={analysis:"A practical plan.",topic:"arms",content_type:"routine",message:"train",answer:"3 sets",presentation:"cards",reason:"useful",expected_response:"save",goal_connection:"install",difference_from_recent:"new",sources:[]};

test("five distinct examples per stage survive repeat calls, research saves and resumes; production reuses analysis",async()=>{
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);seed(db);
 try{
  const [id]=store.create(1);store.state(id,"running");
  const [first,second]=await Promise.all([queryStageReferences(db,id,"analysis",input),queryStageReferences(db,id,"analysis",{...input,query:"Arm"})]);
  assert.equal(first.posts.length,5);assert.deepEqual(first.posts.map(p=>p.id),second.posts.map(p=>p.id));
  store.save(id,"analysis",{research:[]});assert.equal(getReferenceContext(db,id,"analysis")?.posts.length,5);
  assert.equal(store.get(id).analysis.research instanceof Array,true);
  assert.equal((store.get(id).analysis.research as unknown[]).length,0);
  store.state(id,"stopped");store.state(id,"running");
  assert.equal((await queryStageReferences(db,id,"analysis",input)).posts.length,5);
  store.completeAnalysis(id,direction);store.state(id,"running");
  assert.deepEqual((await queryStageReferences(db,id,"production",{...input,ids:first.posts.map(p=>String(p.id))})).posts.map(p=>p.id),first.posts.map(p=>p.id));
  await assert.rejects(()=>queryStageReferences(db,id,"production",{...input,collect:true}),/분석 및 제작 방향/);
  for(const step of ["hook"] as const){
   db.prepare(`INSERT INTO content_${step}_drafts(draft_id,created_at,updated_at) VALUES(?,'now','now')`).run(id);
   db.prepare("UPDATE content_drafts SET current_step=? WHERE id=?").run(step,id);
   let hookCollections=0;
   await assert.rejects(()=>queryStageReferences(db,id,step,{...input,collect:true},async()=>{hookCollections++;return 0;}),/분석 및 제작 방향/);
   assert.equal(hookCollections,0,"hook must reject before calling the collector");
   const selected=await queryStageReferences(db,id,step,input);assert.equal(selected.posts.length,5);
  }
  const all=["analysis","hook"].flatMap(step=>store.get(id).external?.[step as "analysis"]?.posts??[]);
  assert.equal(all.length,10);assert.equal(new Set(all.map(p=>p.id)).size,10);
  db.prepare("UPDATE content_drafts SET current_step='visual' WHERE id=?").run(id);
  await assert.rejects(()=>queryStageReferences(db,id,"visual",input),/외부 레퍼런스를 사용하지/);
 }finally{db.close();}
});
test("one collection allowance per stage, designated accounts only, no collection when stored candidates suffice",async()=>{
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);addReferenceAccount(db,"@example");
 try{
  const [id]=store.create(1);store.state(id,"running");let calls=0;
  const collect=async(_db:typeof db,username:string)=>{calls++;assert.equal(username,"example");seed(db,6);return 6;};
  const result=await queryStageReferences(db,id,"analysis",{...input,collect:true},collect);
  assert.equal(result.posts.length,5);assert.equal(calls,1);
  await queryStageReferences(db,id,"analysis",{...input,collect:true},collect);assert.equal(calls,1);
  const [other]=store.create(1);store.state(other,"running");
  await queryStageReferences(db,other,"analysis",{...input,collect:true},collect);assert.equal(calls,1);
  db.prepare("DELETE FROM content_reference_accounts").run();
  const [empty]=store.create(1);store.state(empty,"running");
  const none=await queryStageReferences(db,empty,"analysis",{...input,query:"unmatched",collect:true},collect);
  assert.match(none.message,/No designated accounts/);assert.equal(calls,1);
 }finally{db.close();}
});
test("excluded examples stay excluded and source image reads require stage selection",async()=>{
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);seed(db,6);
 try{
  const [id]=store.create(1);store.state(id,"running");
  db.prepare("INSERT INTO content_visual_sets VALUES('set','reference',NULL,'https://example.com',1,'now','now')").run();
  db.prepare("UPDATE content_external_references SET visual_set_id='set' WHERE id='5'").run();
  assert.equal(referenceImagesAllowed(db,id,"analysis","set"),false);
  setReferenceExcluded(db,"5",true);
  const found=await queryStageReferences(db,id,"analysis",input);assert.ok(!found.posts.some(p=>p.id==='5'));
  describeReference(db,String(found.posts[0].id),{title:"An arm workout",topic:"Arms",content_type:"A tier chart that groups exercises into ranked rows.",message:"Compare exercise choices"});
  assert.equal(externalReferences(db,"Compare exercise choices").length,1,"search includes the shared message field");
  assert.throws(()=>describeReference(db,String(found.posts[0].id),{title:"An arm workout",topic:"Arms",message:"Compare exercise choices",content_type:""}));
  assert.equal(externalReferences(db,"ranked rows").length,1,"free text search includes format");
  const [next]=store.create(1);store.state(next,"running");setReferenceExcluded(db,"5",false);
  await queryStageReferences(db,next,"analysis",{...input,ids:["5"]});assert.equal(referenceImagesAllowed(db,next,"analysis","set"),true);
  store.state(next,"stopped");await assert.rejects(()=>queryStageReferences(db,next,"analysis",input),/실행 중/);
 }finally{db.close();}
});
