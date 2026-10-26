import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../persistence/store";
import { readTaskTiming, updateTaskTiming } from "./index";
import { executionMilliseconds, formatExecutionTime } from "../../domain/timing";

const at = (seconds: number) => new Date(seconds * 1000).toISOString();
test("execution intervals accumulate resumes and union parallel runs without counting pauses", () => {
  const db = openLocalDatabase(":memory:");
  try {
    updateTaskTiming(db, "one", "analysis", true, at(0));
    updateTaskTiming(db, "one", "analysis", true, at(5)); // repeated running event must not reset
    updateTaskTiming(db, "one", "analysis", false, at(10));
    updateTaskTiming(db, "one", "analysis", true, at(30));
    updateTaskTiming(db, "two", "analysis", true, at(35));
    const one = readTaskTiming(db, "one").analysis!;
    assert.equal(executionMilliseconds(one, 40000), 20000);
    const both = [...one, ...readTaskTiming(db, "two").analysis!];
    assert.equal(executionMilliseconds(both, 40000), 20000);
    updateTaskTiming(db, "one", "analysis", false, at(45));
    assert.equal(executionMilliseconds(readTaskTiming(db, "one").analysis!, 90000), 25000);
    assert.equal(formatExecutionTime(3661000), "1:01:01");
    assert.equal(formatExecutionTime(65000), "01:05");
    assert.equal(formatExecutionTime(0), "00:00");
  } finally { db.close(); }
});

test("draft transitions close the previous stage, protect timing snapshots and remove telemetry on deletion", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const [id] = store.create(1, []);
    store.state(id, "running");
    assert.equal(store.get(id).timing?.analysis?.length, 1);
    store.get(id).timing!.analysis![0].started_at = "mutated client snapshot";
    assert.notEqual(store.get(id).timing!.analysis![0].started_at, "mutated client snapshot");
    store.save(id, "analysis", { analysis: "Progress" });
    assert.equal(store.get(id).timing!.analysis![0].ended_at, null);
    store.state(id, "failed", "Retry required");
    assert.ok(store.get(id).timing!.analysis![0].ended_at);
    store.state(id, "running");
    store.completeAnalysis(id, { analysis: "Comparison", topic: "Arms", message: "A session", content_type: "Routine",
      answer: "Three moves", presentation: "Cards", reason: "Useful", expected_response: "Save",
      goal_connection: "Follow", difference_from_recent: "New answer", sources: [] });
    assert.equal(store.get(id).timing!.analysis!.length, 2);
    assert.ok(store.get(id).timing!.analysis![1].ended_at);
    assert.equal(store.get(id).timing!.production, undefined);
    store.state(id, "running");
    assert.equal(store.get(id).timing!.production![0].ended_at, null);
    store.state(id, "stopped");
    assert.ok(store.get(id).timing!.production![0].ended_at);
    store.remove(id);
    assert.deepEqual(readTaskTiming(db, id), {});
  } finally { db.close(); }
});
