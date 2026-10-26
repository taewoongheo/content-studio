import type { PerformanceRefresh } from "@/domains/content-production/domain/performance";
import { MarkerType, type Edge } from "@xyflow/react";
import { productionSteps, type WorkDetail, type WorkItem } from "@/domains/content-production/domain/contracts";
import type { StartNodeModel } from "./start-node";
import type { StageNodeModel } from "./stage-node";
import { getStepState } from "../../model/task-controls";
export type WorkflowNode = StageNodeModel | StartNodeModel;
const palette = ["#2563eb", "#0f766e", "#b45309", "#7c3aed", "#be185d", "#0369a1"];
const colors = new Map<string, string>();
export function instanceColor(id: string) {
  if (!colors.has(id)) colors.set(id, palette[colors.size % palette.length]);
  return colors.get(id)!;
}
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown) => Array.isArray(value) ? value.length : 0;
export function buildWorkflowGraph(tasks: WorkItem[], details: Record<string, WorkDetail>, writes: Record<string, number>, activity: Record<string, string>, syncing: boolean, report?: PerformanceRefresh | null, planningCount = 0) {
  const nodes: WorkflowNode[] = [{ id: "start", type: "start", position: { x: 0, y: 0 }, data: {} }];
  const edges: Edge[] = [];
  if (syncing || tasks.length || report) {
    nodes.push({ id: "sync", type: "stage", position: { x: 380, y: 0 }, data: {
      intervals: report ? [{ started_at: report.started_at, ended_at: report.completed_at }] : [],
      title: "분석 자료", stage: "sync", state: syncing ? "running" : report?.state === "failed" ? "failed" : report?.state === "completed" || tasks.some(task => task.state !== "pending") ? "completed" : "pending", color: "#475569", write: 0, kind: "",
      outputTitle: "분석 참고 게시글", outputText: syncing ? "최신 반응을 가져오고 있어요" : "조회 · 좋아요 · 저장 · 댓글 · 공유", facts: [`${planningCount}개 게시글`], activity: syncing ? "성과 조회 중" : report?.state === "failed" ? "수집 실패" : "",
    } });
    edges.push({ id: "start-sync", source: "start", target: "sync", type: "straight", animated: syncing, markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, style: { stroke: "#475569", strokeWidth: 2.5 } });
  }
  tasks.forEach((task, index) => {
    if (task.state === "pending" && task.current_step === "analysis" && !writes[`${task.id}:analysis`]) return;
    const color = instanceColor(task.id), detail = details[task.id], analysis = detail?.analysis ?? {};
    const content = record(detail?.visual?.content ?? detail?.polish?.content ?? detail?.hook?.content ?? detail?.production?.content ?? detail?.log.content_summary);
    const topic = text(analysis.topic) || task.topic || "소재 분석 중";
    const answer = text(analysis.answer) || text(detail?.log.answer) || text(analysis.message);
    const currentIndex = productionSteps.findIndex(value => value.id === task.current_step);
    const completed = task.state === "finished";
    let previous = "sync";
    for (const [stageIndex, stage] of ([...productionSteps.map(value => value.id), "result"] as const).entries()) {
      if (stage !== "result" && stageIndex > currentIndex) continue;
      if (stage === "result" && (!completed || task.current_step !== "visual" || !task.project_id)) continue;
      const state = stage === "result" ? "completed" : getStepState(task, stage);
      const stepWrites = writes[`${task.id}:${stage === "result" ? "visual" : stage}`] ?? 0;
      const facts = stage === "analysis" ? [text(analysis.content_type) || task.content_type, count(analysis.sources) ? `참고 자료 ${count(analysis.sources)}개` : null] : [count(content.slides) ? `${count(content.slides)}장` : null, text(analysis.content_type) || task.content_type];
      const id = `${task.id}:${stage}`;
      nodes.push({ id, type: "stage", position: { x: 760 + stageIndex * 380, y: index * 320 }, data: {
        intervals: stage === "result" ? Object.values(detail?.timing ?? {}).flat() : detail?.timing?.[stage] ?? [],
        title: stage === "result" ? "완성 포스트" : productionSteps.find(value => value.id === stage)!.label, stage,
        outputTitle: stage === "hook" ? text(detail?.hook?.content && record(detail.hook.content).hook) || text(content.hook) || topic : stage === "production" ? text(content.hook) || topic : topic,
        outputText: stage === "analysis" ? answer : stage === "hook" || stage === "visual" || stage === "polish" ? text(detail?.[stage]?.review) : "", facts: facts.filter((fact): fact is string => !!fact),
        activity: state === "running" ? activity[task.id] || "진행 중" : state === "failed" ? "오류 확인" : state === "stopped" ? "중단됨" : "",
        color, state, write: stage === "result" ? 0 : stepWrites, kind: `콘텐츠 ${String(index + 1).padStart(2, "0")}`,
      } });
      edges.push({ id: `${previous}-${id}`, source: previous, target: id, type: previous === "sync" ? "branch" : "straight", animated: state === "running", markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: 2.5 } });
      previous = id;
    }
  });
  const branches = edges.filter(edge => edge.type === "branch");
  const lastBranch = branches.at(-1);
  if (lastBranch) edges.unshift({ id: "sync-branch-trunk", source: "sync", target: lastBranch.target, type: "trunk", style: { stroke: "#94a3b8", strokeWidth: 2.5 }, selectable: false });
  return { nodes, edges };
}
