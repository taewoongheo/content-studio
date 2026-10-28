import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
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

test("최근 5개와 나머지 성과 상위 후보 10개 중 5개를 중복 없이 선정한다", () => {
 const {db,store}=fixture(40);
 try {
  const rows=store.planningLogs();
  assert.equal(rows.length,10);assert.equal(new Set(rows.map(row=>row.id)).size,10);
  assert.deepEqual(rows.slice(5).map(row=>row.id),Array.from({length:5},(_,i)=>`post-${i}`));
  assert.ok(rows.slice(0,5).every(row=>Number(String(row.id).split('-')[1])>=5&&Number(String(row.id).split('-')[1])<15));
  assert.equal(store.logs().length,40);assert.equal(store.planningLogs("missing").length,0);
 }finally{db.close();}
});
test("성과가 누락된 게시글은 최근 그룹으로만 포함하고 작은 풀은 중복하지 않는다",()=>{
 const {db,store}=fixture(6);
 try{
  db.prepare("UPDATE content_creation_logs SET like_count=NULL WHERE id='post-5'").run();
  assert.equal(store.planningLogs().length,5);
  db.prepare("UPDATE content_creation_logs SET view_count=100,like_count=1,comment_count=40,save_count=0 WHERE id='post-0'").run();
  assert.equal(store.planningLogs().find(row=>row.id==='post-0')?.engagement_rate,0.41);
 }finally{db.close();}
});
