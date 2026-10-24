import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { readVisualReferences } from "./visual";

test("visual references match text before images, use publication recency, and exclude unpublished posts", () => {
  const db=openLocalDatabase(":memory:");
  try {
    for(let i=0;i<9;i++) {
      db.prepare(`INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at)
        VALUES(?,?,'4:5',1,'English','{}','now','now')`).run(String(i),i===8?"Back routine":"Arm routine");
      db.prepare(`INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,topic,message,created_at,updated_at)
        VALUES(?,?,?,?,?,?, 'now','now')`).run(String(i),String(i),i===7?null:`https://example.com/${i}`,`2026-10-${String(i+1).padStart(2,'0')}T00:00:00Z`,i===8?"Back":"Arms",i===8?"Lat pulldown":"Curl plan");
    }
    assert.deepEqual(readVisualReferences(db,["arms","curl"]).map(row=>row.id),["6","5","4","3","2"]);
    assert.deepEqual(readVisualReferences(db,["back"]).map(row=>row.id),["8"]);
    assert.equal(readVisualReferences(db,["abs"]).length,0);
    assert.equal(readVisualReferences(db,["%_"]).length,0,"wildcards must be literal");
    assert.throws(()=>readVisualReferences(db,[]));
  } finally { db.close(); }
});
