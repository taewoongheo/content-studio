"use client";
import { useState } from "react";
import { History, ChevronDown, Folder, ListFilter, Trash2 } from "lucide-react";
import type { ProductionStep, WorkItem } from "@/domains/content-production/domain/contracts";
import { StatusIcon } from "../workflow/status-icon";
import { getStepState, productionSteps } from "../../model/task-controls";
export function ProductionSidebar({ openDraftIds, tasks, model, busy, selectedId, selectedStep, onSelect, onSelectStep, onAction, onDelete, onLibrary }: {
  openDraftIds: ReadonlySet<string>; tasks: WorkItem[]; model: string; busy: boolean; selectedId?: string; selectedStep?: ProductionStep | "project";
  onSelect: (task: WorkItem) => void; onSelectStep: (id: string, step: ProductionStep) => void; onAction: (action: Record<string, unknown>) => void; onLibrary: () => void;
  onDelete: (task: WorkItem) => void;
}) {
  const [showFinished, setShowFinished] = useState(false);
  const visible = tasks.filter(t => showFinished || t.state !== "finished" || openDraftIds.has(t.id));
  return <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-background max-md:w-52" aria-label="제작 사이드바">
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-3 pb-2"><h2 className="text-xs font-medium text-muted-foreground">프로젝트 {visible.length}</h2><button className={`rounded-md p-2 hover:bg-muted ${showFinished ? "bg-muted text-foreground" : "text-muted-foreground"}`} aria-label="완료된 프로젝트 표시" title="완료된 프로젝트 표시" aria-pressed={showFinished} onClick={() => setShowFinished(!showFinished)}><ListFilter size={15} /></button></div>

      {visible.map(task => <article key={task.id} className="mx-2 mb-3 rounded-lg border border-border/60 p-2" aria-label={`프로젝트 ${task.topic ?? "소재 분석 중"}`}>
        <button aria-pressed={selectedId === task.id && selectedStep === "project"} className={`flex w-full items-center gap-2 rounded-md p-2 text-left text-xs font-medium hover:bg-muted ${selectedId === task.id && selectedStep === "project" ? "bg-muted" : ""}`} onClick={() => onSelect(task)}><Folder size={15} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{task.topic ?? "소재 분석 중"}</span><StatusIcon state={task.state} size={14} /></button>
        <div className="ml-4 mt-1 space-y-1 border-l pl-2" aria-label="프로젝트 단계">
          {productionSteps.map(({ id: step, label }) => {
            const state = getStepState(task, step);
            const selected = selectedId === task.id && selectedStep === step;
            return <button key={step} aria-pressed={selected} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[11px] hover:bg-muted ${selected ? "bg-muted font-medium text-foreground" : "text-muted-foreground"}`} onClick={() => onSelectStep(task.id, step)}><StatusIcon state={state} size={14} />{label}</button>;
          })}
        </div>
        <div className="mt-1 flex justify-end px-1">
          <button type="button" disabled={busy} aria-label="프로젝트 삭제" title="삭제" className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-40" onClick={() => onDelete(task)}><Trash2 size={16} /></button>
        </div>
      </article>)}
    </div>
    <footer className="shrink-0 space-y-3 border-t p-3">
      <button className="flex w-full items-center gap-2 rounded-md p-2 text-xs hover:bg-muted" onClick={onLibrary}><History size={15} />제작 기록·레퍼런스</button>
      <details className="rounded-lg border p-3"><summary className="flex cursor-pointer items-center justify-between gap-2 text-xs"><span className="shrink-0">제작 모델</span><span className="min-w-0 truncate text-muted-foreground" title={model}>{model}</span><ChevronDown size={13} className="shrink-0" /></summary>
        <form key={model} className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); onAction({ action: "settings", settings: { model: new FormData(e.currentTarget).get("model") } }); }}>
          <label htmlFor="production-model" className="sr-only">제작용 Codex 모델</label><input id="production-model" name="model" className="production-field" defaultValue={model} required /><button className="production-button w-full" disabled={busy}>모델 저장</button><p className="text-[10px] leading-4 text-muted-foreground">새 시작·재개부터 적용</p>
        </form>
      </details>
    </footer>
  </aside>;
}
