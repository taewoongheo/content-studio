"use client";
import { useMemo, useState, useCallback, type ReactNode } from "react";
import {
  useReactFlow,
  Background,
  Controls,
  Panel,
  ReactFlow,
  type NodeMouseHandler,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LocateFixed } from "lucide-react";
import { StageNode } from "./workflow/stage-node";
import { StartNode } from "./workflow/start-node";
import { buildWorkflowGraph, type WorkflowNode } from "./workflow/graph";
import type {
  WorkItem,
  WorkDetail,
  ProductionStep,
} from "@/domains/content-production/domain/contracts";
const nodeTypes = { stage: StageNode, start: StartNode };
const initialViewport = { x: 48, y: 64, zoom: 1 };

function StartNodeControl() {
  const { getNode, setCenter, fitView } = useReactFlow();
  const duration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;
  return <Panel position="bottom-center" className="flex gap-2">
    <button type="button" className="production-button shadow-sm" aria-label="시작 노드로 이동" onClick={() => {
      const node = getNode("start");
      if (node) void setCenter(node.position.x + (node.measured?.width ?? 300) / 2, node.position.y + (node.measured?.height ?? 120) / 2, { zoom: 1, duration: duration() });
    }}><LocateFixed size={15} />시작 노드</button>
    <button type="button" className="production-button shadow-sm" aria-label="전체 흐름 보기" onClick={() => void fitView({ padding: 0.15, maxZoom: 1, duration: duration() })}>전체 보기</button>
  </Panel>;
}

export function WorkflowCanvas({
  startContent,
  tasks,
  details,
  writes,
  activity,
  syncing,
  selectedNode,
  onSelect,
  onOpen,
}: {
  startContent: ReactNode;
  tasks: WorkItem[];
  details: Record<string, WorkDetail>;
  writes: Record<string, number>;
  activity: Record<string, string>;
  syncing: boolean;
  selectedNode?: string;
  onSelect: (id: string, step: ProductionStep) => void;
  onOpen: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => buildWorkflowGraph(tasks, details, writes, activity, syncing), [tasks, details, writes, activity, syncing]);
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback<OnNodesChange<WorkflowNode>>(changes => {
    setMeasurements(previous => {
      let next = previous;
      for (const change of changes) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const old = next[change.id], size = change.dimensions;
        if (old?.width === size.width && old?.height === size.height) continue;
        if (next === previous) next = { ...previous };
        next[change.id] = size;
      }
      return next;
    });
  }, []);
  // Controlled nodes must retain ResizeObserver measurements when their data changes.
  const renderedNodes = nodes.map(node => ({ ...node, measured: measurements[node.id] })).map(node => node.type === "start" ? { ...node, data: { content: startContent } } : { ...node, selected: node.id === selectedNode });
  const click: NodeMouseHandler<WorkflowNode> = (_, node) => {
    if (node.id === "sync" || node.id === "start") return;
    const [id, step] = node.id.split(":");
    if (step === "result") {
      const task = tasks.find((t) => t.id === id);
      if (task?.project_id) onOpen(task.project_id);
    } else onSelect(id, step as ProductionStep);
  };
  return (
    <div className="production-canvas">
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={click}
        onNodesChange={onNodesChange}
        defaultViewport={initialViewport}
        autoPanOnNodeFocus={false}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.25}
        maxZoom={1.4}
        aria-label="콘텐츠 제작 파이프라인"
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <StartNodeControl />
      </ReactFlow>

    </div>
  );
}
