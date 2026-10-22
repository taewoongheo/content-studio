"use client";
import { useMemo, useEffect, useRef } from "react";
import {
  useReactFlow,
  useNodesInitialized,
  useStore,
  Background,
  Controls,
  Panel,
  ReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { LocateFixed } from "lucide-react";
import { StageNode, type StageNodeModel } from "./workflow/stage-node";
import { buildWorkflowGraph } from "./workflow/graph";
import type {
  WorkItem,
  WorkDetail,
  ProductionStep,
} from "@/domains/content-production/domain/contracts";
const nodeTypes = { stage: StageNode };
function FitWorkflow({ layoutKey, selectedNode }: { layoutKey: string; selectedNode?: string }) {
  const fitted = useRef<string | null>(null);
  const focused = useRef<string | undefined>(undefined);
  const { fitView } = useReactFlow();
  const ready = useNodesInitialized();
  const width = useStore((state) => state.width),
    height = useStore((state) => state.height);
  useEffect(() => {
    if (ready && width && height && fitted.current !== layoutKey) {
      fitted.current = layoutKey;
      void fitView({ padding: 0.22, maxZoom: 1 });
    }
  }, [ready, width, height, layoutKey, fitView]);
  useEffect(() => {
    if (!selectedNode) { focused.current = undefined; return; }
    if (ready && width && height && focused.current !== selectedNode) {
      focused.current = selectedNode;
      void fitView({ nodes: [{ id: selectedNode }], padding: 0.6, maxZoom: 1, duration: 200 });
    }
  }, [selectedNode, ready, width, height, fitView]);
  return null;
}

function StartNodeControl() {
  const { getNode, setCenter } = useReactFlow();
  return <Panel position="bottom-center"><button type="button" className="production-button shadow-sm" aria-label="시작 노드로 이동" onClick={() => {
    const node = getNode("sync");
    if (node) void setCenter(node.position.x + (node.measured?.width ?? 300) / 2, node.position.y + (node.measured?.height ?? 120) / 2, { zoom: 1, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250 });
  }}><LocateFixed size={15} />시작 노드</button></Panel>;
}

export function WorkflowCanvas({
  tasks,
  details,
  writes,
  activity,
  syncing,
  selectedNode,
  onSelect,
  onOpen,
}: {
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
        <FitWorkflow layoutKey={nodes.map(node => node.id).join(",")} selectedNode={selectedNode} />
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <StartNodeControl />
      </ReactFlow>

    </div>
  );
}
