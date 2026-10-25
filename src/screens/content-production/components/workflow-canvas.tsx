"use client";
import type { PerformanceRefresh } from "@/domains/content-production/domain/performance";
import { useMemo, useRef, type ReactNode } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CenterInitialStart, HorizontalWheelPan, StartNodeControl } from "./workflow/viewport/viewport-controls";
import { StageNode } from "./workflow/stage-node";
import { StartNode } from "./workflow/start-node";
import { AdaptiveEdge, BranchEdge, BranchTrunk } from "./workflow/edges/branch-edges";
import { buildWorkflowGraph, type WorkflowNode } from "./workflow/graph";
import { layoutNodes } from "../model/layout";
import { useNodeMeasurements } from "../hooks/use-node-measurements";
import { getPlaybackAction, type TaskActionHandler, type TaskControlAction } from "../model/task-controls";
import type {
  WorkItem,
  WorkDetail,
  ProductionStep,
} from "@/domains/content-production/domain/contracts";
const nodeTypes = { stage: StageNode, start: StartNode };
const edgeTypes = { straight: AdaptiveEdge, branch: BranchEdge, trunk: BranchTrunk };
const initialViewport = { x: 48, y: 64, zoom: 1 };


export function WorkflowCanvas({
  startContent,
  tasks,
  details,
  writes,
  activity,
  syncing,
  syncReport,
  planningCount,
  selectedNode,
  onSelect,
  onSelectSync,
  onSelectProject,
  onComplete,
  onOpen,
  onStop,
  onReset,
  resetDisabled,
  stopDisabled,
  onTaskAction,
  busy,
}: {
  startContent: ReactNode;
  tasks: WorkItem[];
  details: Record<string, WorkDetail>;
  writes: Record<string, number>;
  activity: Record<string, string>;
  syncing: boolean;
  syncReport: PerformanceRefresh | null;
  planningCount: number;
  selectedNode?: string;
  onSelect: (id: string, step: ProductionStep) => void;
  onSelectSync: () => void;
  onSelectProject: (id: string) => void;
  onComplete: (id: string) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
  resetDisabled: boolean;
  onStop: () => void;
  stopDisabled: boolean;
  onTaskAction: TaskActionHandler;
  busy: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { nodes, edges } = useMemo(() => buildWorkflowGraph(tasks, details, writes, activity, syncing, syncReport, planningCount), [tasks, details, writes, activity, syncing, syncReport, planningCount]);
  const { measurements, onNodesChange } = useNodeMeasurements();
  const tasksById = new Map(tasks.map(task => [task.id, task]));
  // Controlled nodes must retain ResizeObserver measurements when their data changes.
  const renderedNodes = layoutNodes(nodes, measurements).map(node => {
    const measured = measurements[node.id];
    if (node.type === "start") return { ...node, measured, data: { content: startContent } };
    const task = tasksById.get(node.id.split(":")[0]);
    const step = node.data.stage === "result" || node.data.stage === "sync" ? "polish" : node.data.stage;
    const action: TaskControlAction | null = task ? node.data.stage === "result" ? "delete_post" : getPlaybackAction(task, step) : null;
    return { ...node, measured, selected: node.id === selectedNode, data: { ...node.data, onComplete: node.data.stage === "result" && task ? () => onComplete(task.id) : undefined, onOpen: node.data.stage === "result" && task?.project_id ? () => onOpen(task.project_id!) : undefined, controls: task ? {
      action,
      disabled: busy,
      onAction: () => { if (action) onTaskAction(task.id, action, action === "delete_post" ? undefined : step); },
    } : undefined } };
  });
  const click: NodeMouseHandler<WorkflowNode> = (_, node) => {
    if (node.id === "sync") { onSelectSync(); return; }
    if (node.id === "start") return;
    const [id, step] = node.id.split(":");
    if (step === "result") {
      onSelectProject(id);
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
        <StartNodeControl onReset={onReset} resetDisabled={resetDisabled} onStop={onStop} stopDisabled={stopDisabled} />
      </ReactFlow>

    </div>
  );
}
