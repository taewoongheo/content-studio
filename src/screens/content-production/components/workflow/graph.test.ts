import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkflowGraph } from "./graph";
import { advanceSimulation, startSimulation, emptySimulation } from "../../preview/simulation";

test("작업은 병렬로 진행하고 각 작업의 노드는 시작한 단계까지만 표시한다", () => {
  let model = startSimulation(4, false);
  const graph = () => buildWorkflowGraph(model.data.tasks, model.details, model.writes, model.activity, model.data.sync.running);
  assert.deepEqual(graph().nodes.map(node => node.id), ["start", "sync"]);
  model = advanceSimulation(advanceSimulation(model));
  assert.equal(graph().nodes.length, 6);
  assert.ok(graph().nodes.slice(2).every(node => node.type === "stage" && node.data.stage === "analysis"));
  for (let i = 0; i < 4; i++) model = advanceSimulation(model);
  assert.ok(graph().nodes.some(node => node.id === "mock-task-1:production"));
  assert.ok(!graph().nodes.some(node => node.id === "mock-task-4:production"));
  assert.ok(!graph().nodes.some(node => node.type === "stage" && node.data.stage === "result"));
  const analysis = graph().nodes.find(node => node.id === "mock-task-1:analysis")!;
  assert.ok(analysis.type === "stage");
  assert.equal(analysis.data.outputTitle, "주 3일 전신 루틴");
  assert.match(analysis.data.outputText, /기본 동작 5개/);
  for (let i = 0; i < 25; i++) model = advanceSimulation(model);
  const finished = graph();
  assert.equal(finished.nodes.length, 14);
  assert.equal(finished.nodes.filter(node => node.type === "stage" && node.data.stage === "result").length, 4);
  assert.ok(finished.edges.every(edge => finished.nodes.some(node => node.id === edge.source) && finished.nodes.some(node => node.id === edge.target)));
});


test("시작 노드는 고정 원점에 있고 모든 경로의 출발점이다", () => {
  const empty = emptySimulation();
  const before = buildWorkflowGraph(empty.data.tasks, {}, {}, {}, false);
  assert.deepEqual(before.nodes.map(node => node.id), ["start"]);
  assert.deepEqual(before.nodes[0].position, { x: 0, y: 0 });
  let model = startSimulation(4, false);
  for (let i = 0; i < 30; i++) model = advanceSimulation(model);
  const graph = buildWorkflowGraph(model.data.tasks, model.details, model.writes, model.activity, false);
  assert.deepEqual(graph.nodes.find(node => node.id === "start")?.position, before.nodes[0].position);
  assert.deepEqual(graph.nodes.find(node => node.id === "sync")?.position, { x: 380, y: 0 });
  const reachable = new Set(["start"]);
  for (const edge of graph.edges) if (reachable.has(edge.source)) reachable.add(edge.target);
  assert.equal(reachable.size, graph.nodes.length);
});
