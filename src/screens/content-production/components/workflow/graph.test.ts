import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkflowGraph } from "./graph";
import { advanceSimulation, startSimulation } from "../../preview/simulation";

test("작업은 병렬로 진행하고 각 작업의 노드는 시작한 단계까지만 표시한다", () => {
  let model = startSimulation(4, false);
  const graph = () => buildWorkflowGraph(model.data.tasks, model.details, model.writes, model.activity, model.data.sync.running);
  assert.deepEqual(graph().nodes.map(node => node.id), ["sync"]);
  model = advanceSimulation(advanceSimulation(model));
  assert.equal(graph().nodes.length, 5);
  assert.ok(graph().nodes.slice(1).every(node => node.data.stage === "analysis"));
  for (let i = 0; i < 4; i++) model = advanceSimulation(model);
  assert.ok(graph().nodes.some(node => node.id === "mock-task-1:production"));
  assert.ok(!graph().nodes.some(node => node.id === "mock-task-4:production"));
  assert.ok(!graph().nodes.some(node => node.data.stage === "result"));
  const analysis = graph().nodes.find(node => node.id === "mock-task-1:analysis")!;
  assert.equal(analysis.data.outputTitle, "주 3일 전신 루틴");
  assert.match(analysis.data.outputText, /기본 동작 5개/);
  for (let i = 0; i < 25; i++) model = advanceSimulation(model);
  const finished = graph();
  assert.equal(finished.nodes.length, 13);
  assert.equal(finished.nodes.filter(node => node.data.stage === "result").length, 4);
  assert.ok(finished.edges.every(edge => finished.nodes.some(node => node.id === edge.source) && finished.nodes.some(node => node.id === edge.target)));
});
