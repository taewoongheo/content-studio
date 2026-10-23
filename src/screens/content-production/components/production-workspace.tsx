"use client";
import { PerformanceDetails } from "./details/performance-details";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, RefreshCw, X, History } from "lucide-react";
import { getOpenDrafts, OPEN_DRAFT_MESSAGE } from "@/domains/content-production/domain/start-policy";
import { useNodeDetails } from "../hooks/use-node-details";
import { useTranslatedDetails } from "../hooks/display/use-translated-details";
import { useProductionControls } from "../hooks/use-production-controls";
import { StepDetails } from "./step-details";
import { ProjectDetails } from "./details/project-details";
import { LibraryPanel } from "./library/panel";
import { ProductionSidebar } from "./navigation/production-sidebar";
import type { useProduction } from "../hooks/use-production";
import type { ProductionStep, WorkDetail } from "@/domains/content-production/domain/contracts";
import "../production.css";
const WorkflowCanvas = dynamic(() => import("./workflow-canvas").then(m => m.WorkflowCanvas), { ssr: false, loading: () => <div className="production-canvas" /> });
export type ProductionRuntime = ReturnType<typeof useProduction>;
export function ProductionWorkspace({ runtime, readWork, onOpen }: {
  runtime: ProductionRuntime;
  readWork: (id: string) => Promise<WorkDetail>;
  onOpen: (id: string) => Promise<void>;
}) {
  const { data, error, busy, writes, activity, reload, act } = runtime;
  const { dispatch: safe, taskAction, removeTask, stopAll, controlsBusy, stopDisabled } = useProductionControls(runtime);
  const openDraftIds = new Set(data ? getOpenDrafts(data.tasks).map(task => task.id) : []);
  const blockedByDraft = openDraftIds.size > 0;
  const details = useNodeDetails(data?.tasks, readWork);
  const display = useTranslatedDetails(details);
  const displayTasks = data?.tasks.map(task => ({ ...task, topic: String(display.details[task.id]?.analysis.topic ?? task.topic ?? "") || null }));
  const [count, setCount] = useState(1);
  const [panel, setPanel] = useState<"library" | "performance" | null>(null);
  const [selected, setSelected] = useState<{ id: string; step: ProductionStep | "project" } | null>(null);
  const current = data?.tasks.find(t => t.id === selected?.id);
  const select = (id: string, step: ProductionStep) => { setPanel(null); setSelected({ id, step }); };
  const startContent = (
      <div>
        <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); if (data?.configured.apify && !blockedByDraft) safe({ action: "start", count }); }}>
          <label className="text-xs" htmlFor="production-count">제작 개수</label>
          <input id="production-count" className="production-field !w-16" type="number" min={1} value={count} onChange={e => setCount(Number(e.target.value))} required />
          <button className="production-button primary" disabled={busy || !data?.configured.apify || data.sync.running || blockedByDraft}><Play size={14} />{data?.sync.running ? "성과 갱신 중" : "시작"}</button>
          <button type="button" className="production-button" aria-label="새로고침" onClick={() => void reload()}><RefreshCw size={14} /></button>
        </form>
        {blockedByDraft && <p className="mt-3 text-xs leading-5 text-muted-foreground">{OPEN_DRAFT_MESSAGE}</p>}
        {error && <p role="alert" className="mt-2 max-w-md text-xs text-destructive">{error}</p>}
        {data && !data.configured.apify && <p role="alert" className="mt-2 max-w-sm text-xs text-destructive">Apify에 연결되지 않아 제작을 시작할 수 없습니다. 서버에 APIFY_API_TOKEN을 설정해 주세요.</p>}
      </div>
  );
  return <div className="flex h-full min-h-0 overflow-hidden">
    <ProductionSidebar openDraftIds={openDraftIds} tasks={displayTasks ?? []} model={data?.settings.model ?? "gpt-5.6-sol"} busy={busy} selectedId={selected?.id} selectedStep={selected?.step}
      onSelect={task => { setPanel(null); setSelected({ id: task.id, step: "project" }); }} onSelectStep={select} onAction={safe} onDelete={removeTask}
      onLibrary={() => { setPanel("library"); setSelected(null); }} />
    <main className="relative min-h-0 min-w-0 flex-1" aria-label="제작 작업 공간">
      <WorkflowCanvas startContent={startContent} details={display.details} selectedNode={panel === "performance" ? "sync" : selected ? `${selected.id}:${selected.step}` : undefined} tasks={displayTasks ?? []} writes={writes} activity={activity} syncing={data?.sync.running ?? false} syncReport={data?.sync.report ?? null} planningCount={data?.planningLogs.length ?? 0} onSelect={select} onSelectSync={() => { setSelected(null); setPanel("performance"); }} onOpen={id => void onOpen(id)} onStop={() => void stopAll()} stopDisabled={stopDisabled} onTaskAction={taskAction} busy={controlsBusy} />
      {display.error && <p role="alert" className="absolute bottom-4 left-16 right-16 z-10 rounded border bg-background p-3 text-xs text-destructive">{display.error}</p>}

      {selected && current && <aside className="absolute inset-y-0 right-0 z-20 w-[420px] max-w-full overflow-y-auto border-l bg-background shadow-lg" aria-label="작업 상세">
        {selected.step === "project" ? <ProjectDetails key={current.id} onPublish={url => act({ action: "register", id: current.log_id, url })} task={displayTasks?.find(task => task.id === current.id) ?? current} onSelectStep={select} onOpen={id => void onOpen(id)} onClose={() => setSelected(null)} /> : <StepDetails id={selected.id} step={selected.step} updated={current.updated_at} write={writes[`${selected.id}:${selected.step}`] ?? 0} readWork={readWork} onClose={() => setSelected(null)} />}
      </aside>}
      {panel === "performance" && data && <aside className="absolute inset-y-0 right-0 z-20 w-[440px] max-w-full overflow-y-auto border-l bg-background shadow-lg">
        <PerformanceDetails report={data.sync.report} logs={data.planningLogs} details={details} onClose={() => setPanel(null)} />
      </aside>}
      {panel === "library" && <section className="absolute inset-y-0 right-0 z-20 flex w-[560px] max-w-full flex-col border-l bg-background shadow-lg" aria-label="기록과 레퍼런스">
        <header className="flex shrink-0 items-center justify-between border-b px-6 py-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><History size={16} />기록과 레퍼런스</h2><button className="production-button" onClick={() => setPanel(null)} aria-label="캔버스로 돌아가기"><X size={14} />닫기</button></header>
        <div className="min-h-0 flex-1 overflow-auto p-6">{data ? <LibraryPanel logs={data.logs} references={data.references} visuals={data.visuals} act={act} onOpen={id => void onOpen(id)} /> : null}</div>
      </section>}
    </main>
  </div>;
}
