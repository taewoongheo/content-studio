"use client";
import { useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, Database, FileText, Layers, ScanText, Play, Square, Trash2 } from "lucide-react";
import { StatusIcon } from "./status-icon";
export type StageNodeModel = Node<{
  title: string;
  stage: "sync" | "analysis" | "production" | "result";
  outputTitle: string;
  outputText: string;
  facts: string[];
  activity: string;
  state: string;
  color: string;
  write: number;
  kind: string;
  controls?: { canStop: boolean; canResume: boolean; busy: boolean; onStop: () => void; onResume: () => void; onDelete: () => void };
}, "stage">;
const stageIcons = { sync: Database, analysis: ScanText, production: Layers, result: FileText };
export function StageNode({ id, data, selected }: NodeProps<StageNodeModel>) {
  const updateNodeInternals = useUpdateNodeInternals();
  // A controlled node can lose its handle measurements without changing size.
  // ResizeObserver alone cannot restore connections in that case.
  useEffect(() => { updateNodeInternals(id); }, [id, data, updateNodeInternals]);
  const StageIcon = stageIcons[data.stage];
  return <div className={`production-stage ${selected ? "selected" : ""}`} style={{ "--instance-color": data.color } as React.CSSProperties}>
    <Handle type="target" position={Position.Left} />
    <div className="production-stage-header">
      <span className="production-stage-title"><StageIcon size={17} />{data.title}</span>
      <StatusIcon state={data.state} />
    </div>
    <div className="production-stage-content">
      {data.kind && <span className="production-instance-label">{data.kind}</span>}
      <h3 className="production-output-title">{data.outputTitle}</h3>
      {data.outputText && <p className="production-output-text">{data.outputText}</p>}
      {!!data.facts.length && <div className="production-output-facts">{data.facts.map(fact => <span key={fact}>{fact}</span>)}</div>}
    </div>
    {(data.stage !== "sync" || data.activity) && <div className="production-stage-footer">
      <span className="production-stage-action">{data.stage === "result" ? <>포스트 열기<ArrowUpRight size={14} /></> : data.activity || (data.stage === "analysis" ? "분석 보기" : data.stage === "production" ? "작성 내용 보기" : "시작")}</span>
      <div className="flex items-center gap-2">
      {data.controls && (data.stage === "result" ? <button type="button" className="production-node-button is-destructive nodrag nopan" aria-label="포스트 삭제" disabled={data.controls.busy} onClick={event => { event.stopPropagation(); data.controls?.onDelete(); }}><Trash2 size={16} />삭제</button> : (data.controls.canStop || data.controls.canResume) ? <button type="button" className="production-node-button nodrag nopan" aria-label={`${data.title} ${data.controls.canStop ? "멈춤" : "재생"}`} title={data.controls.canStop ? "멈춤" : "재생"} disabled={data.controls.busy} onClick={event => { event.stopPropagation(); if (data.controls?.canStop) data.controls.onStop(); else data.controls?.onResume(); }}>
        {data.controls.canStop ? <Square size={18} /> : <Play size={18} />}
      </button> : null)}
      {data.write > 0 && <span className="production-save-indicator" aria-label="draft 저장" title="draft 저장">
        <span key={data.write} className="production-save-dot production-write-pulse" />
      </span>}
      </div>
    </div>}
    {data.stage !== "result" && <Handle type="source" position={Position.Right} />}
  </div>;
}
