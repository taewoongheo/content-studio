import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../store";
import { ANALYSIS_INPUTS } from "./index";
import { readPlanningLogs } from "../logs";

test("batch inputs freeze IDs and metrics, survive saves/reconnect, and never recursively copy old contexts", () => {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  try {
    db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Post','4:5',1,'English','{}','now','now')").run();
    db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,content_summary_json,created_at,updated_at) VALUES('l','p','https://example.com/post','2026-10-25',100,10,1,1,?,'now','now')").run(JSON.stringify({draft_context:{analysis:{research_json:"huge prior inputs"}}}));
    db.prepare("INSERT INTO content_performance(log_id,stage,view_count,like_count,comment_count,save_count,share_count) VALUES('l','early',100,10,0,1,NULL),('l','late',500,30,2,10,3)").run();
    const ids=store.create(2);
    const first=store.analysisInputs(ids[0]);
    assert.deepEqual(first,store.analysisInputs(ids[1]));
    assert.equal(first[0].like_count,10);
    assert.deepEqual(first[0].performance,[
      {stage:"early",view_count:100,like_count:10,comment_count:0,save_count:1,share_count:null},
      {stage:"late",view_count:500,like_count:30,comment_count:2,save_count:10,share_count:3},
    ]);
    assert.equal("content_summary" in first[0],false);
    db.prepare("UPDATE content_creation_logs SET like_count=99 WHERE id='l'").run();
    db.prepare("UPDATE content_performance SET view_count=999 WHERE log_id='l'").run();
    store.state(ids[0],"running");
    store.save(ids[0],"analysis",{research:[{question:ANALYSIS_INPUTS,source:"agent",finding:"[]",judgment:"Overwrite"}]});
    assert.deepEqual(new ProductionStore(db).analysisInputs(ids[0]),first);
    assert.deepEqual(store.get(ids[0]).analysis.research,[]);
    assert.equal(store.analysisLogs(ids[0],["l"])[0].like_count,10,"assigned metrics, not later live values");
    assert.deepEqual(store.analysisLogs(ids[0],["l"])[0].performance,first[0].performance,"stage metrics stay frozen across later collections");
    assert.throws(()=>store.analysisLogs(ids[0],["unassigned"]),/전달된 분석/);
    assert.deepEqual(store.get(ids[0]).analysis_inputs,[{id:"l",project_id:"p",selection_group:"recent"}]);
  } finally {db.close();}
});

test("stage records do not change recent/rate selection and missing stages remain empty", () => {
  const db=openLocalDatabase(":memory:");
  try {
    assert.deepEqual(readPlanningLogs(db,""),[]);
    for(let i=1;i<=6;i++) {
      db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES(?,?,'4:5',1,'English','{}','now','now')").run(`p${i}`,`Post ${i}`);
      db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at) VALUES(?,?,?, ?,100,10,0,0,'now','now')").run(`l${i}`,`p${i}`,`https://example.com/${i}`,`2026-10-0${i}`);
    }
    const before=readPlanningLogs(db,"");
    assert.equal(before.length,6);
    assert.deepEqual(before.map(row=>row.performance),Array.from({length:6},()=>[]));
    assert.equal(before[0].selection_group,"performance");
    assert.equal(before[0].id,"l1");
    assert.ok(before.slice(1).every(row=>row.selection_group === "recent"));
    db.prepare("INSERT INTO content_performance(log_id,stage,view_count) VALUES('l1','late',1),('l6','early',99999)").run();
    const after=readPlanningLogs(db,"");
    assert.deepEqual(after.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key !== "performance"))),
      before.map(row=>Object.fromEntries(Object.entries(row).filter(([key])=>key !== "performance"))));
    assert.equal((after[0].performance as Array<{stage:string}>)[0].stage,"late");
  } finally {db.close();}
});
