import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkflowGraph } from "./graph";
import type { WorkDetail, WorkItem } from "@/domains/content-production/domain/contracts";

function task(index: number, patch: Partial<WorkItem> = {}): WorkItem {
  return { id: `task-${index}`, log_id: `log-${index}`, current_step: "analysis", state: "pending", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", project_id: null, topic: "주 3일 전신 루틴", content_type: "루틴", ...patch };
}
function details(tasks: WorkItem[]): Record<string, WorkDetail> {
  return Object.fromEntries(tasks.map(task => [task.id, {
    task, analysis: { topic: task.topic, answer: "기본 동작 5개로 시작하는 루틴" }, production: null, log: {},
  }]));
}

test("작업은 병렬로 진행하고 각 작업의 노드는 시작한 단계까지만 표시한다", () => {
  let tasks = Array.from({ length: 4 }, (_, index) => task(index + 1));
  const graph = () => buildWorkflowGraph(tasks, details(tasks), {}, {}, false);
  assert.deepEqual(graph().nodes.map(node => node.id), ["start", "sync"]);
  tasks = tasks.map(task => ({ ...task, state: "running" }));
  assert.equal(graph().nodes.length, 6);
  assert.ok(graph().nodes.slice(2).every(node => node.type === "stage" && node.data.stage === "analysis"));
  tasks[0] = { ...tasks[0], current_step: "production", project_id: "post-1" };
  assert.ok(graph().nodes.some(node => node.id === "task-1:production"));
  assert.ok(!graph().nodes.some(node => node.id === "task-4:production"));
  assert.ok(!graph().nodes.some(node => node.type === "stage" && node.data.stage === "result"));
  const analysis = graph().nodes.find(node => node.id === "task-1:analysis")!;
  assert.ok(analysis.type === "stage");
  assert.equal(analysis.data.outputTitle, "주 3일 전신 루틴");
  assert.match(analysis.data.outputText, /기본 동작 5개/);
  tasks = tasks.map((task, index) => ({ ...task, current_step: "production", state: "finished", project_id: `post-${index + 1}` }));
  const finished = graph();
  assert.equal(finished.nodes.length, 14);
  assert.equal(finished.edges.length, 14);
  assert.equal(finished.nodes.filter(node => node.type === "stage" && node.data.stage === "result").length, 4);
  assert.ok(finished.edges.every(edge => finished.nodes.some(node => node.id === edge.source) && finished.nodes.some(node => node.id === edge.target)));
});

test("시작 노드는 고정 원점에 있고 모든 경로의 출발점이다", () => {
  const before = buildWorkflowGraph([], {}, {}, {}, false);
  assert.deepEqual(before.nodes.map(node => node.id), ["start"]);
  assert.deepEqual(before.nodes[0].position, { x: 0, y: 0 });
  const tasks = Array.from({ length: 4 }, (_, index) => task(index + 1, { state: "finished", current_step: "production", project_id: `post-${index + 1}` }));
  const graph = buildWorkflowGraph(tasks, details(tasks), {}, {}, false);
  assert.deepEqual(graph.nodes.find(node => node.id === "start")?.position, before.nodes[0].position);
  assert.deepEqual(graph.nodes.find(node => node.id === "sync")?.position, { x: 380, y: 0 });
  const reachable = new Set(["start"]);
  for (const edge of graph.edges) if (reachable.has(edge.source)) reachable.add(edge.target);
  assert.equal(reachable.size, graph.nodes.length);
});
