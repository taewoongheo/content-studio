"use client";
import { useState } from "react";
import { History, Settings, ChevronDown } from "lucide-react";
import type { WorkItem } from "@/domains/content-production/domain/contracts";
const labels: Record<string, string> = { running: "실행 중", pending: "대기", stopped: "중단", failed: "실패", finished: "제작 완료" };
export function ProductionSidebar({ tasks, model, busy, selectedId, onSelect, onAction, onLibrary, onSettings }: {
  tasks: WorkItem[]; model: string; busy: boolean; selectedId?: string;
  onSelect: (task: WorkItem) => void; onAction: (action: Record<string, unknown>) => void; onLibrary: () => void; onSettings: () => void;
}) {
  const [showFinished, setShowFinished] = useState(false);
  const visible = tasks.filter(t => showFinished || t.state !== "finished");
  return <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-background max-md:w-52" aria-label="제작 사이드바">
    <header className="border-b px-4 py-5"><h1 className="text-sm font-semibold">Content Studio</h1><p className="mt-1 text-xs text-muted-foreground">콘텐츠 제작 작업 공간</p></header>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-5 pb-2"><h2 className="text-xs font-medium text-muted-foreground">작업 {visible.length}</h2><button className="text-[11px] text-muted-foreground" aria-pressed={showFinished} onClick={() => setShowFinished(!showFinished)}>{showFinished ? "진행 중만" : "완료 포함"}</button></div>

      {visible.map(task => <article key={task.id} className={`mx-2 mb-2 rounded-lg border p-3 ${selectedId === task.id ? "border-foreground/30 bg-muted" : "border-transparent hover:bg-muted/50"}`}>
        <button className="w-full text-left" onClick={() => onSelect(task)}><span className="block truncate text-xs font-medium">{task.topic ?? "소재 분석 중"}</span><span className="mt-1 block text-[11px] text-muted-foreground">{labels[task.state] ?? task.state} · {task.current_step === "analysis" ? "분석·방향" : "콘텐츠 제작"}</span></button>
        <div className="mt-3 flex gap-3 text-[11px]">
          {["running", "pending"].includes(task.state) && <button disabled={busy} onClick={() => onAction({ action: "stop", id: task.id })}>중단</button>}
          {["stopped", "failed"].includes(task.state) && <button disabled={busy} onClick={() => onAction({ action: "resume", id: task.id })}>재개</button>}
          <button disabled={busy} className="text-muted-foreground" onClick={() => { if (window.confirm("모든 단계 draft를 제거할까요? 저장된 포스트는 유지됩니다.")) onAction({ action: "remove", id: task.id }); }}>취소·제거</button>
        </div>
      </article>)}
    </div>
    <footer className="shrink-0 space-y-3 border-t p-3">
      <button className="flex w-full items-center gap-2 rounded-md p-2 text-xs hover:bg-muted" onClick={onLibrary}><History size={15} />제작 기록·레퍼런스</button>
      <button className="flex w-full items-center gap-2 rounded-md p-2 text-xs hover:bg-muted" onClick={onSettings}><Settings size={15} />연결 설정</button>
      <details className="rounded-lg border p-3"><summary className="flex cursor-pointer items-center justify-between text-xs">제작 모델<ChevronDown size={13} /></summary>
        <form key={model} className="mt-3 space-y-2" onSubmit={e => { e.preventDefault(); onAction({ action: "settings", settings: { model: new FormData(e.currentTarget).get("model") } }); }}>
          <label htmlFor="production-model" className="sr-only">제작용 Codex 모델</label><input id="production-model" name="model" className="production-field" defaultValue={model} required /><button className="production-button w-full" disabled={busy}>모델 저장</button><p className="text-[10px] leading-4 text-muted-foreground">새 시작·재개부터 적용</p>
        </form>
      </details>
      <p className="truncate px-1 text-[10px] text-muted-foreground" title={model}>{model}</p>
    </footer>
  </aside>;
}
