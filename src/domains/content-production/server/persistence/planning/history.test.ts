import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { topicHistory } from "../../topics/input";
import { ProductionStore } from "../store";

function fixture(count: number) {
  const db = openLocalDatabase(":memory:");
  for (let index = 0; index < count; index++) {
    const id = `post-${index}`;
    const published = new Date(Date.UTC(2026, 9, 30 - index)).toISOString();
    const created = new Date(Date.UTC(2026, 9, index + 1)).toISOString();
    db.prepare(`INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at)
      VALUES(?,?,'4:5',1,'English','{}',?,?)`).run(id, index < 15 ? "Arms" : "Back", created, created);
    db.prepare(`INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at)
      VALUES(?,?,?,?,10000,?,0,0,?,?)`).run(id, id, `https://example.com/${id}`, published, 1000 - index, created, created);
  }
  return { db, store: new ProductionStore(db) };
}

test("topic matching considers all published history without a recent/high-rate sample", () => {
 const {db,store}=fixture(40);
 try {
  const rows=topicHistory(db);
  assert.equal(rows.length,40);assert.equal(new Set(rows.map(row=>row.id)).size,40);
  assert.equal(store.logs().length,40);
  const [id]=store.create(1);
  assert.deepEqual(store.analysisInputs(id),[],"creating a draft must not draw unrelated posts from history");
 }finally{db.close();}
});
test("missing metrics do not remove a post from semantic matching",()=>{
 const {db}=fixture(6);
 try{
  db.prepare("UPDATE content_creation_logs SET like_count=NULL WHERE id='post-5'").run();
  assert.equal(topicHistory(db).length,6);
  assert.equal(topicHistory(db).find(row=>row.id==='post-5')?.like_count,null);
 }finally{db.close();}
});
