import test from "node:test";
import assert from "node:assert/strict";
import { hasOpenDrafts } from "./start-policy";
import type { WorkItem } from "./contracts";

test("모든 남은 제작은 새 시작을 막고 게시 완료나 명시적 제거 후 허용한다", () => {
  const task: WorkItem = { id: "task", log_id: "log", state: "pending", current_step: "analysis", created_at: "", updated_at: "", project_id: null, topic: null, content_type: null };
  for (const state of ["pending", "running", "stopped", "failed", "finished"]) {
    assert.equal(hasOpenDrafts([{ ...task, state }]), true);
  }
  assert.equal(hasOpenDrafts([task]), true);
  assert.equal(hasOpenDrafts([]), false);
});
