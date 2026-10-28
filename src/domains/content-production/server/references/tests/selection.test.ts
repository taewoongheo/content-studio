import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { queryStageReferences, referenceImagesAllowed } from "../selection";
import { getReferenceContext } from "../context";
import { setReferenceExcluded, describeReference, externalReferences } from "../library";
const input={query:"",content_type:"",collect:false};
function seed(db:ReturnType<typeof openLocalDatabase>,count=12) {
  for(let i=0;i<count;i++)db.prepare("INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,created_at,view_count,like_count,comment_count,save_count) VALUES(?,?, 'example',?,'now','[]','now',100,?,1,2)")
    .run(String(i),`https://www.tiktok.com/@example/photo/${i}`,i<4?"Arm workout":"Back workout",i);
}
const direction={analysis: "A practical plan.", reasoning: { observations: [], interpretations: [], candidates: [] },topic:"arms",content_type:"routine",message:"train",answer:"3 sets",presentation:"cards",reason:"useful",expected_response:"save",goal_connection:"install",difference_from_recent:"new",sources:[]};

test("분석은 고정된 최대 10개, 후속 단계는 관련 자료 최대 5개만 DB에서 조회한다",async()=>{
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);seed(db);
 try {
  const [id]=store.create(1);store.state(id,"running");
  const first=await queryStageReferences(db,id,"analysis",input);
  assert.equal(first.posts.length,10);
  assert.deepEqual((await queryStageReferences(db,id,"analysis",{...input,query:"Arm"})).posts,first.posts);
  store.save(id,"analysis",{research:[]});assert.equal(getReferenceContext(db,id,"analysis")?.posts.length,10);
  await assert.rejects(()=>queryStageReferences(db,id,"analysis",{...input,collect:true}),/수집하지 않습니다/);
  store.completeAnalysis(id,direction);store.state(id,"running");
  const next=await queryStageReferences(db,id,"production",{...input,query:"Arm"});
  assert.equal(next.posts.length,4);assert.ok(next.posts.every(row=>String(row.caption).includes("Arm")));
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
  setReferenceExcluded(db,"5",false);const [next]=store.create(1);store.state(next,"running");
  await queryStageReferences(db,next,"analysis",{...input,ids:["5"]});assert.equal(referenceImagesAllowed(db,next,"analysis","set"),true);
  store.state(next,"stopped");await assert.rejects(()=>queryStageReferences(db,next,"analysis",input),/실행 중/);
 }finally{db.close();}
});
