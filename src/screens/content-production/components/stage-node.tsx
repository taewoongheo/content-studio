"use client";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Check, Circle, LoaderCircle, TriangleAlert } from "lucide-react";
export type StageNodeModel = Node<
  {
    title: string;
    subtitle: string;
    state: string;
    color: string;
    write: number;
    kind: string;
  },
  "stage"
>;
export function StageNode({ data, selected }: NodeProps<StageNodeModel>) {
  const Icon =
    data.state === "running"
      ? LoaderCircle
      : data.state === "completed" || data.state === "finished"
        ? Check
        : data.state === "failed"
          ? TriangleAlert
          : Circle;
  return (
    <div
      className={`production-stage ${selected ? "selected" : ""}`}
      style={{ "--instance-color": data.color } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} />
      <div
        key={data.write}
        className={data.write ? "production-write-pulse" : ""}
      >
        <div className="flex items-center gap-3">
          <span className="production-node-icon">
            <Icon
              size={18}
              className={data.state === "running" ? "animate-spin" : ""}
            />
          </span>
          <span className="font-semibold text-sm">{data.title}</span>
        </div>
        <p className="mt-3 truncate text-xs text-muted-foreground">
          {data.subtitle}
        </p>
        <span className="mt-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
          {data.kind}
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
