import { MarkerType, type Edge } from "@xyflow/react";
import type { WorkDetail, WorkItem } from "@/domains/content-production/domain/contracts";
import type { StartNodeModel } from "./start-node";
import type { StageNodeModel } from "./stage-node";
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
export function buildWorkflowGraph(tasks: WorkItem[], details: Record<string, WorkDetail>, writes: Record<string, number>, activity: Record<string, string>, syncing: boolean) {
  const nodes: WorkflowNode[] = [{ id: "start", type: "start", position: { x: 0, y: 0 }, data: {} }];
  const edges: Edge[] = [];
  if (syncing || tasks.length) {
    nodes.push({ id: "sync", type: "stage", position: { x: 380, y: 0 }, data: {
      title: "성과 갱신", stage: "sync", state: syncing ? "running" : tasks.some(task => task.state !== "pending") ? "completed" : "pending", color: "#475569", write: 0, kind: "",
      outputTitle: "최근 게시물 성과", outputText: syncing ? "최신 반응을 가져오고 있어요" : "조회 · 좋아요 · 저장 · 댓글 · 공유", facts: [], activity: syncing ? "성과 조회 중" : "",
    } });
    edges.push({ id: "start-sync", source: "start", target: "sync", type: "smoothstep", animated: syncing, markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" }, style: { stroke: "#475569", strokeWidth: 2.5 } });
  }
  tasks.forEach((task, index) => {
    if (task.state === "pending" && task.current_step === "analysis" && !writes[`${task.id}:analysis`]) return;
    const color = instanceColor(task.id), detail = details[task.id], analysis = detail?.analysis ?? {};
    const content = record(detail?.production?.content ?? detail?.log.content_summary);
    const topic = text(analysis.topic) || task.topic || "소재 분석 중";
    const answer = text(analysis.answer) || text(detail?.log.answer) || text(analysis.message);
    const activeProduction = task.current_step === "production";
    const completed = task.state === "finished";
    let previous = "sync";
    for (const stage of ["analysis", "production", "result"] as const) {
      if (stage === "production" && !activeProduction) continue;
      if (stage === "result" && (!completed || !task.project_id)) continue;
      const state = stage === "analysis" ? activeProduction ? "completed" : task.state : stage === "result" ? "completed" : task.state;
      const stepWrites = writes[`${task.id}:${stage === "result" ? "production" : stage}`] ?? 0;
      const facts = stage === "analysis" ? [text(analysis.content_type) || task.content_type, count(analysis.sources) ? `참고 자료 ${count(analysis.sources)}개` : null] : [count(content.slides) ? `${count(content.slides)}장` : null, text(analysis.content_type) || task.content_type];
      const id = `${task.id}:${stage}`;
      nodes.push({ id, type: "stage", position: { x: stage === "analysis" ? 760 : stage === "production" ? 1140 : 1520, y: index * 320 }, data: {
        title: stage === "analysis" ? "분석·제작 방향" : stage === "production" ? "콘텐츠 제작" : "완성 포스트", stage,
        outputTitle: stage === "production" ? text(content.hook) || topic : topic,
        outputText: stage === "analysis" ? answer : answer || text(content.message), facts: facts.filter((fact): fact is string => !!fact),
        activity: state === "running" ? activity[task.id] || "진행 중" : state === "failed" ? "오류 확인" : state === "stopped" ? "중단됨" : "",
        color, state, write: stage === "result" ? 0 : stepWrites, kind: `콘텐츠 ${String(index + 1).padStart(2, "0")}`,
      } });
      edges.push({ id: `${previous}-${id}`, source: previous, target: id, type: "smoothstep", animated: state === "running", markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: 2.5 } });
      previous = id;
    }
  });
  return { nodes, edges };
}
