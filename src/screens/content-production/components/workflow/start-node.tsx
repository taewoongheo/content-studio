"use client";
import type { ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Play } from "lucide-react";
export type StartNodeModel = Node<{ content?: ReactNode }, "start">;

export function StartNode({ data }: NodeProps<StartNodeModel>) {
  return <div className="production-stage production-start-node">
    <div className="production-stage-header"><span className="production-stage-title"><Play size={17} />제작 시작</span></div>
    <div className="production-start-content nodrag nowheel nopan">{data.content}</div>
    <Handle type="source" position={Position.Right} />
  </div>;
}
