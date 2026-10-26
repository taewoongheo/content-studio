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

test("상위·하위 각 10개를 고른 뒤 중복 없이 실제 게시일 최신 10개를 채운다", () => {
  const { db, store } = fixture(40);
  try {
    const rows = store.planningLogs();
    assert.equal(rows.length, 30);
    assert.equal(new Set(rows.map(row => row.id)).size, 30);
    assert.deepEqual(rows.slice(0, 10).map(row => row.id), Array.from({ length: 10 }, (_, i) => `post-${i}`));
    assert.deepEqual(rows.slice(10, 20).map(row => row.id), Array.from({ length: 10 }, (_, i) => `post-${39 - i}`));
    assert.ok(rows.slice(0, 10).every(row => row.selection_group === "performance"));
    assert.ok(rows.slice(10, 20).every(row => row.selection_group === "low_performance"));
    assert.deepEqual(rows.slice(20).map(row => row.id), Array.from({ length: 10 }, (_, i) => `post-${i + 10}`));
    assert.ok(rows.slice(20).every(row => row.selection_group === "recent"));
    assert.equal(rows[0].engagement_rate, 0.1);
    assert.equal(store.logs().length, 40);
    assert.equal(store.planningLogs("Arms").length, 15);
    assert.equal(store.planningLogs("missing").length, 0);
  } finally { db.close(); }
});

test("좋아요·댓글·저장을 합산하고 조회로 나누며, 성과 미제공은 상·하위 순위에 넣지 않고 최근 그룹에만 포함한다", () => {
  const { db, store } = fixture(6);
  try {
    db.prepare("UPDATE content_creation_logs SET view_count=100,like_count=1,comment_count=40,save_count=0 WHERE id='post-0'").run();
    db.prepare("UPDATE content_creation_logs SET view_count=100,like_count=1,comment_count=0,save_count=30 WHERE id='post-1'").run();
    db.prepare("UPDATE content_creation_logs SET view_count=1000000,like_count=1000 WHERE id='post-2'").run();
    db.prepare("UPDATE content_creation_logs SET like_count=NULL WHERE id='post-3'").run();
    db.prepare("UPDATE content_creation_logs SET view_count=0 WHERE id='post-4'").run();
    db.prepare("UPDATE content_creation_logs SET post_url=NULL WHERE id='post-5'").run();
    const rows = store.planningLogs();
    assert.deepEqual(rows.map(row => row.id), ["post-0", "post-1", "post-2", "post-3", "post-4"]);
    assert.deepEqual(rows.map(row => row.selection_group), ["performance", "performance", "performance", "recent", "recent"]);
    assert.equal(rows[0].engagement_rate, 0.41);
    assert.equal(rows[3].engagement_rate, null);
    assert.equal(rows[4].engagement_rate, null);
  } finally { db.close(); }
});

test("작은 풀은 중복으로 채우지 않고 실제 반응 0건은 하위 순위에 포함한다", () => {
  const { db, store } = fixture(23);
  try {
    db.prepare("UPDATE content_creation_logs SET like_count=0,comment_count=0,save_count=0 WHERE id='post-22'").run();
    const rows = store.planningLogs();
    assert.equal(rows.length, 23);
    assert.equal(new Set(rows.map(row => row.id)).size, 23);
    assert.equal(rows.filter(row => row.selection_group === "performance").length, 10);
    assert.equal(rows.filter(row => row.selection_group === "low_performance").length, 10);
    assert.equal(rows.filter(row => row.selection_group === "recent").length, 3);
    assert.equal(rows[10].id, "post-22");
    assert.equal(rows[10].engagement_rate, 0);
  } finally { db.close(); }
});
