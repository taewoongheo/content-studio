"use client";
import { useMemo, useEffect } from "react";
import {
  useReactFlow,
  useNodesInitialized,
  useStore,
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StageNode, type StageNodeModel } from "./stage-node";
import type {
  WorkItem,
  ProductionStep,
} from "@/domains/content-production/domain/contracts";
const nodeTypes = { stage: StageNode };
function FitWorkflow({ layoutKey }: { layoutKey: string }) {
  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();
  const width = useStore((state) => state.width),
    height = useStore((state) => state.height);
  useEffect(() => {
    if (ready && width && height) void fitView({ padding: 0.22, maxZoom: 1 });
  }, [ready, width, height, layoutKey, fitView]);
  return null;
}

const colors = new Map<string, string>();
export function instanceColor(id: string) {
  if (!colors.has(id))
    colors.set(id, `hsl(${(165 + colors.size * 137.508) % 360} 46% 43%)`);
  return colors.get(id)!;
}
const labels: Record<string, string> = {
  pending: "대기",
  running: "실행 중",
  stopped: "중단",
  failed: "실패",
  finished: "제작 종료",
  completed: "완료",
};
export function WorkflowCanvas({
  tasks,
  writes,
  activity,
  syncing,
  onSelect,
  onOpen,
}: {
  tasks: WorkItem[];
  writes: Record<string, number>;
  activity: Record<string, string>;
  syncing: boolean;
  onSelect: (id: string, step: ProductionStep) => void;
  onOpen: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const nodes: StageNodeModel[] = [
      {
        id: "sync",
        type: "stage",
        position: { x: 0, y: Math.max(0, (tasks.length - 1) * 95) },
        data: {
          title: "성과 갱신",
          subtitle: syncing ? "최근 게시물 수집 중" : "시작 요청당 한 번",
          state: syncing ? "running" : "pending",
          color: "#58645d",
          write: 0,
          kind: "SHARED",
        },
      },
    ];
    const edges: Edge[] = [];
    tasks.forEach((task, index) => {
      const color = instanceColor(task.id),
        y = index * 190;
      for (const [step, x, title] of [
        ["analysis", 330, "분석 및 제작 방향"],
        ["production", 660, "콘텐츠 제작"],
        ["result", 990, "포스트 열기"],
      ] as const) {
        const state =
          step === "analysis"
            ? task.current_step === "production"
              ? "completed"
              : task.state
            : step === "production"
              ? task.current_step === "production"
                ? task.state
                : "pending"
              : task.state === "finished"
                ? "completed"
                : "pending";
        nodes.push({
          id: `${task.id}:${step}`,
          type: "stage",
          position: { x, y },
          data: {
            title,
            subtitle:
              step === "result"
                ? task.project_id
                  ? "편집기에서 확인"
                  : "저장된 포스트 없음"
                : task.current_step === step && task.state === "running"
                  ? (activity[task.id] ?? "실행 중")
                  : (labels[state] ?? state),
            state,
            color,
            write: writes[`${task.id}:${step}`] ?? 0,
            kind: `${String(index + 1).padStart(2, "0")} / ${task.topic ?? task.id.slice(0, 8)}`,
          },
        });
      }
      for (const [from, to] of [
        ["sync", `${task.id}:analysis`],
        [`${task.id}:analysis`, `${task.id}:production`],
        [`${task.id}:production`, `${task.id}:result`],
      ])
        edges.push({
          id: `${from}-${to}`,
          source: from,
          target: to,
          type: "smoothstep",
          animated:
            task.state === "running" &&
            to === `${task.id}:${task.current_step}`,
          style: { stroke: color, strokeWidth: 2, opacity: 0.65 },
        });
    });
    return { nodes, edges };
  }, [tasks, writes, activity, syncing]);
  const click: NodeMouseHandler<StageNodeModel> = (_, node) => {
    if (node.id === "sync") return;
    const [id, step] = node.id.split(":");
    if (step === "result") {
      const task = tasks.find((t) => t.id === id);
      if (task?.project_id) onOpen(task.project_id);
    } else onSelect(id, step as ProductionStep);
  };
  return (
    <div className="production-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={click}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.25}
        maxZoom={1.4}
        aria-label="콘텐츠 제작 파이프라인"
      >
        <FitWorkflow layoutKey={tasks.map((task) => task.id).join(",")} />
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!tasks.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          제작을 시작하면 각 작업의 흐름이 여기에 표시됩니다.
        </div>
      )}
    </div>
  );
}
