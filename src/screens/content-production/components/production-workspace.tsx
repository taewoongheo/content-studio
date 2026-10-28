"use client";
import { SamplingControls } from "./start/sampling-settings";
import { defaultSampling } from "@/domains/content-production/domain/references/sampling";
import { StartControls } from "./start/start-controls";
import { PerformanceDetails } from "./details/performance-details";
import { useState } from "react";
import dynamic from "next/dynamic";
import { X, History } from "lucide-react";
import { getOpenDrafts } from "@/domains/content-production/domain/start-policy";
import { useNodeDetails } from "../hooks/use-node-details";
import { useDetailTranslationPrefetch } from "../hooks/display/use-detail-translation-prefetch";
import { useProductionControls } from "../hooks/use-production-controls";
import { StepDetails } from "./step-details";
import { PublishDialog } from "./publication/publish-dialog";
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
  const { taskAction, removeTask, stopAll, resetAll, resetDisabled, controlsBusy, stopDisabled } = useProductionControls(runtime);
  const openDraftIds = new Set(data ? getOpenDrafts(data.tasks).map(task => task.id) : []);
  const blockedByDraft = openDraftIds.size > 0;
  const details = useNodeDetails(data?.tasks, readWork);
  useDetailTranslationPrefetch(details);
  const [panel, setPanel] = useState<"library" | "performance" | null>(null);
  const [selected, setSelected] = useState<{ id: string; step: ProductionStep | "project" } | null>(null);
  const [publishTaskId, setPublishTaskId] = useState<string | null>(null);
  const publishTask = data?.tasks.find(task => task.id === publishTaskId && task.state === "finished");
  const current = data?.tasks.find(t => t.id === selected?.id);
  const select = (id: string, step: ProductionStep) => { setPanel(null); setSelected({ id, step }); };
  const startContent = <div className="space-y-3"><SamplingControls key={JSON.stringify(data?.sampling)} value={data?.sampling ?? defaultSampling} disabled={busy} onSave={settings=>act({action:"sampling_settings",settings})} /><StartControls key={runtime.resetVersion} posts={data?.publishedPosts ?? []}
    busy={busy} blockedByDraft={blockedByDraft} configured={data?.configured.apify}
    syncing={data?.sync.running ?? false} error={error ?? ""}
    onStart={requests => act({ action: "start", requests })} onReload={() => void reload()} /></div>;
  return <div className="flex h-full min-h-0 overflow-hidden">
    <ProductionSidebar openDraftIds={openDraftIds} tasks={data?.tasks ?? []} busy={busy} selectedId={selected?.id} selectedStep={selected?.step}
      onSelect={task => { setPanel(null); setSelected({ id: task.id, step: "project" }); }} onSelectStep={select} onDelete={removeTask}
      onLibrary={() => { setPanel("library"); setSelected(null); }} />
    <main className="relative min-h-0 min-w-0 flex-1" aria-label="제작 작업 공간">
      <WorkflowCanvas key={runtime.resetVersion} onReset={() => void (async () => {
        if (await resetAll()) { setSelected(null); setPanel(null); setPublishTaskId(null); }
      })()} resetDisabled={resetDisabled} startContent={startContent} details={details} selectedNode={panel === "performance" ? "sync" : selected ? `${selected.id}:${selected.step === "project" && current?.state === "finished" ? "result" : selected.step}` : undefined} tasks={data?.tasks ?? []} writes={writes} activity={activity} syncing={data?.sync.running ?? false} syncReport={data?.sync.report ?? null} planningCount={data?.planningLogs.length ?? 0} onSelect={select} onSelectSync={() => { setSelected(null); setPanel("performance"); }} onComplete={setPublishTaskId} onOpen={id => void onOpen(id)} onSelectProject={id => { setPanel(null); setSelected({id,step:"project"}); }} onStop={() => void stopAll()} stopDisabled={stopDisabled} onTaskAction={taskAction} busy={controlsBusy} />

      {selected && current && <aside className="absolute inset-y-0 right-0 z-20 w-[420px] max-w-full overflow-y-auto border-l bg-background shadow-lg" aria-label="작업 상세">
        {selected.step === "project" ? <ProjectDetails key={current.id} task={current} detail={details[current.id]} onSelectStep={select} onOpen={id => void onOpen(id)} onClose={() => setSelected(null)} /> : <StepDetails id={selected.id} step={selected.step} updated={current.updated_at} write={writes[`${selected.id}:${selected.step}`] ?? 0} readWork={readWork} onClose={() => setSelected(null)} />}
      </aside>}
      {panel === "performance" && data && <aside className="absolute inset-y-0 right-0 z-20 w-[440px] max-w-full overflow-y-auto border-l bg-background shadow-lg">
        <PerformanceDetails report={data.sync.report} logs={data.planningLogs} details={details} onClose={() => setPanel(null)} />
      </aside>}
      {panel === "library" && <section className="absolute inset-y-0 right-0 z-20 flex w-[560px] max-w-full flex-col border-l bg-background shadow-lg" aria-label="기록과 레퍼런스">
        <header className="flex shrink-0 items-center justify-between border-b px-6 py-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><History size={16} />기록과 레퍼런스</h2><button className="production-button" onClick={() => setPanel(null)} aria-label="캔버스로 돌아가기"><X size={14} />닫기</button></header>
        <div className="min-h-0 flex-1 overflow-auto p-6">{data ? <LibraryPanel logs={data.logs} externalReferences={data.externalReferences} referenceAccounts={data.referenceAccounts} visuals={data.visuals} act={act} onOpen={id => void onOpen(id)} /> : null}</div>
      </section>}
      {publishTask && <PublishDialog key={publishTask.id} onClose={() => setPublishTaskId(null)} onPublish={async url => {
        await act({ action: "register", id: publishTask.log_id, url });
        setPublishTaskId(null);
      }} />}
    </main>
  </div>;
}
