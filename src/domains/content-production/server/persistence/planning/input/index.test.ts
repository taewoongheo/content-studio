import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../store";
import { ANALYSIS_INPUTS } from "./index";

test("batch inputs freeze IDs and metrics, survive saves/reconnect, and never recursively copy old contexts", () => {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  try {
    db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Post','4:5',1,'English','{}','now','now')").run();
    db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,content_summary_json,created_at,updated_at) VALUES('l','p','https://example.com/post','2026-10-25',100,10,1,1,?,'now','now')").run(JSON.stringify({draft_context:{analysis:{research_json:"huge prior inputs"}}}));
    const ids=store.create(2);
    const first=store.analysisInputs(ids[0]);
    assert.deepEqual(first,store.analysisInputs(ids[1]));
    assert.equal(first[0].like_count,10);
    assert.equal("content_summary" in first[0],false);
    db.prepare("UPDATE content_creation_logs SET like_count=99 WHERE id='l'").run();
    store.state(ids[0],"running");
    store.save(ids[0],"analysis",{research:[{question:ANALYSIS_INPUTS,source:"agent",finding:"[]",judgment:"Overwrite"}]});
    assert.deepEqual(new ProductionStore(db).analysisInputs(ids[0]),first);
    assert.deepEqual(store.get(ids[0]).analysis.research,[]);
    assert.equal(store.analysisLogs(ids[0],["l"])[0].like_count,10,"assigned metrics, not later live values");
    assert.throws(()=>store.analysisLogs(ids[0],["unassigned"]),/전달된 분석/);
    assert.deepEqual(store.get(ids[0]).analysis_inputs,[{id:"l",project_id:"p",selection_group:"performance"}]);
  } finally {db.close();}
});
