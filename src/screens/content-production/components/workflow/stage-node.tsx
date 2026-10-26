"use client";
import { useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from "@xyflow/react";
import { ArrowUpRight, Database, FileText, Layers, ScanText, MessageSquare, Eye, SpellCheck } from "lucide-react";
import { ExecutionTimer } from "./timing/execution-timer";
import type { ExecutionInterval } from "@/domains/content-production/domain/timing";
import { StatusIcon } from "./status-icon";
import { StageControlButton } from "./controls/stage-control-button";
import type { ProductionStep } from "@/domains/content-production/domain/contracts";
import type { StageControl } from "../../model/task-controls";
export type StageNodeModel = Node<{
  intervals?: ExecutionInterval[];
  title: string;
  stage: "sync" | ProductionStep | "result";
  outputTitle: string;
  outputText: string;
  facts: string[];
  activity: string;
  state: string;
  color: string;
  write: number;
  kind: string;
  controls?: StageControl;
  onComplete?: () => void;
  onOpen?: () => void;
}, "stage">;
const stageIcons = { sync: Database, analysis: ScanText, production: Layers, result: FileText, hook: MessageSquare, visual: Eye, polish: SpellCheck };
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
      <span className="flex items-center gap-3">
        <ExecutionTimer intervals={data.intervals ?? []} />
        <StatusIcon state={data.state} />
      </span>
    </div>
    <div className="production-stage-content">
      {data.kind && <span className="production-instance-label">{data.kind}</span>}
      <h3 className="production-output-title">{data.outputTitle}</h3>
      {data.outputText && <p className="production-output-text">{data.outputText}</p>}
      {!!data.facts.length && <div className="production-output-facts">{data.facts.map(fact => <span key={fact}>{fact}</span>)}</div>}
    </div>
    <div className="production-stage-footer">
      {data.stage !== "result" && <span className="production-stage-action">{data.activity || (data.stage === "analysis" ? "분석 보기" : data.stage === "production" ? "작성 내용 보기" : data.stage === "hook" || data.stage === "visual" || data.stage === "polish" ? "검토 보기" : "성과 보기")}</span>}
      <div className={`flex flex-wrap items-center gap-2 ${data.stage === "result" ? "w-full justify-end" : ""}`}>
      {data.stage === "result" && data.onOpen && <button type="button" className="production-button nodrag nopan" onClick={event => { event.stopPropagation(); data.onOpen?.(); }}>편집기로 열기<ArrowUpRight size={14} /></button>}
      {data.stage === "result" && data.onComplete && <button type="button" className="production-button primary nodrag nopan" onClick={event => { event.stopPropagation(); data.onComplete?.(); }}>완료</button>}
      <StageControlButton title={data.title} control={data.controls} />
      {data.write > 0 && <span className="production-save-indicator" aria-label="draft 저장" title="draft 저장">
        <span key={data.write} className="production-save-dot production-write-pulse" />
      </span>}
      </div>
    </div>
    {data.stage !== "result" && <Handle type="source" position={Position.Right} />}
  </div>;
}
