import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "./store";
const direction = {
  topic: "arms",
  content_type: "routine",
  message: "train",
  answer: "3 sets",
  presentation: "cards",
  reason: "useful",
  expected_response: "save",
  goal_connection: "install",
  difference_from_recent: "new",
};

test("단계 출력 검사·분리 저장·재개·취소 후 쓰기 거부", () => {
  const db = openLocalDatabase(":memory:"),
    store = new ProductionStore(db);
  try {
    const [id] = store.create(1);
    store.state(id, "running");
    assert.throws(() => store.save(id, "production", {}), /현재 실행 단계/);
    store.save(id, "analysis", {
      analysis: "partial",
      research: [{ question: "q", source: "url", finding: "f", judgment: "j" }],
    });
    assert.throws(() => store.completeAnalysis(id, {}));
    store.state(id, "stopped");
    assert.throws(() => store.save(id, "analysis", {}));
    store.state(id, "running");
    store.completeAnalysis(id, {
      ...direction,
      analysis: "observation",
      sources: [],
    });
    assert.equal(store.get(id).analysis.state, "completed");
    assert.equal((store.get(id).analysis.research as unknown[]).length, 1);
    store.state(id, "running");
    store.save(id, "production", { content: { hook: "do this" } });
    assert.ok(store.get(id).production?.draft_saved_at);
    store.changeDirection(
      id,
      { ...direction, topic: "back" },
      "research",
      "new evidence",
    );
    assert.equal(store.get(id).log.topic, "arms");
    assert.match(
      String(store.get(id).production?.direction_changes),
      /new evidence/,
    );
    store.changeDirection(id, { ...direction, topic: "legs" }, "collision");
    assert.equal(store.get(id).log.topic, "legs");
    assert.equal(store.get(id).production?.draft_saved_at, null);
    store.remove(id);
    assert.throws(
      () => store.save(id, "production", { content: { hook: "late" } }),
      /취소/,
    );
    assert.equal(
      db.prepare("SELECT count(*) n FROM content_analysis_drafts").get() &&
        (
          db
            .prepare("SELECT count(*) n FROM content_analysis_drafts")
            .get() as { n: number }
        ).n,
      0,
    );
    assert.equal(
      (
        db
          .prepare("SELECT count(*) n FROM content_production_drafts")
          .get() as { n: number }
      ).n,
      0,
    );
  } finally {
    db.close();
  }
});

test("중복 비교는 게시 후 24시간과 보존한 초안만 포함", () => {
  const db = openLocalDatabase(":memory:"),
    store = new ProductionStore(db);
  try {
    const ids = store.create(2);
    for (const [i, id] of ids.entries()) {
      const log = store.get(id).task.log_id;
      db.prepare(
        "UPDATE content_creation_logs SET actual_published_at=? WHERE id=?",
      ).run(new Date(Date.now() - (i ? 48 : 12) * 3600000).toISOString(), log);
    }
    assert.equal(store.comparisons().published.length, 1);
    assert.equal(store.comparisons().drafts.length, 2);
  } finally {
    db.close();
  }
});


test("게시 전 draft는 완료 상태라도 새 제작을 막고 게시 연결 완료 후 해제한다", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    assert.equal(store.hasOpenDrafts(), false);
    const [id] = store.create(1);
    assert.equal(store.hasOpenDrafts(), true);
    store.state(id, "finished");
    assert.equal(store.hasOpenDrafts(), true);
    db.prepare("UPDATE content_creation_logs SET completed_at=? WHERE id=?").run("2026-10-23T00:00:00Z", store.get(id).task.log_id);
    assert.equal(store.hasOpenDrafts(), false);
    const [second] = store.create(1);
    assert.equal(store.hasOpenDrafts(), true);
    store.remove(second);
    assert.equal(store.hasOpenDrafts(), false);
  } finally { db.close(); }
});
