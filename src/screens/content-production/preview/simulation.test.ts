import test from "node:test";
import assert from "node:assert/strict";
import { advanceSimulation, emptySimulation, mockAction, startSimulation } from "./simulation";

test("미리보기는 작업별로 draft를 채우고 다른 속도로 병렬 완료한다", () => {
  const initial = startSimulation(4, false);
  let model = advanceSimulation(advanceSimulation(initial));
  assert.equal(initial.tick, 0);
  assert.equal(initial.data.tasks[0].state, "pending");
  assert.equal(model.data.tasks.filter(task => task.state === "running").length, 4);
  assert.equal(model.writes["mock-task-1:analysis"], 1);
  for (let i = 0; i < 5; i++) model = advanceSimulation(model);
  assert.equal(model.data.tasks[0].current_step, "production");
  assert.equal(model.data.tasks[3].current_step, "analysis");
  assert.ok(model.details["mock-task-1"].production?.content);
  for (let i = 0; i < 20; i++) model = advanceSimulation(model);
  assert.ok(model.data.tasks.every(task => task.state === "finished"));
  assert.equal(model.data.logs.length, 5);
});
test("중단은 해당 작업 진행을 보존하고 오류 작업은 재개할 수 있다", () => {
  let model = advanceSimulation(advanceSimulation(startSimulation(4, true)));
  model = mockAction(model, { action: "stop", id: "mock-task-1" });
  for (let i = 0; i < 12; i++) model = advanceSimulation(model);
  assert.equal(model.progress["mock-task-1"], 1);
  assert.equal(model.data.tasks[2].state, "failed");
  model = mockAction(model, { action: "resume", id: "mock-task-3" });
  model = mockAction(model, { action: "resume", id: "mock-task-1" });
  for (let i = 0; i < 25; i++) model = advanceSimulation(model);
  assert.ok(model.data.tasks.every(task => task.state === "finished"));
  model = mockAction(model, { action: "remove", id: "mock-task-1" });
  assert.equal(model.details["mock-task-1"], undefined);
  assert.equal(model.progress["mock-task-1"], undefined);
});
test("모델과 기록 수정은 입력 스냅샷을 변경하지 않는 메모리 동작이다", () => {
  const initial = emptySimulation();
  let model = mockAction(initial, { action: "settings", settings: { model: "preview-only" } });
  model = mockAction(model, { action: "edit_log", id: "mock-history", patch: { message: "수정" } });
  assert.equal(model.data.settings.model, "preview-only");
  assert.equal(initial.data.settings.model, "gpt-5.6-sol");
  assert.notEqual(initial.data.logs[0].message, "수정");
});
