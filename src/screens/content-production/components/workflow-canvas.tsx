"use client";
import { useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CenterInitialStart, HorizontalWheelPan, StartNodeControl } from "./workflow/viewport/viewport-controls";
import { StageNode } from "./workflow/stage-node";
import { StartNode } from "./workflow/start-node";
import { BranchEdge, BranchTrunk } from "./workflow/edges/branch-edges";
import { buildWorkflowGraph, type WorkflowNode } from "./workflow/graph";
import type {
  WorkItem,
  WorkDetail,
  ProductionStep,
} from "@/domains/content-production/domain/contracts";
const nodeTypes = { stage: StageNode, start: StartNode };
const edgeTypes = { branch: BranchEdge, trunk: BranchTrunk };
const initialViewport = { x: 48, y: 64, zoom: 1 };


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
  const containerRef = useRef<HTMLDivElement>(null);
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
    <div ref={containerRef} className="production-canvas">
      <ReactFlow
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
        <CenterInitialStart />
        <HorizontalWheelPan containerRef={containerRef} />
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <StartNodeControl />
      </ReactFlow>

    </div>
  );
}
