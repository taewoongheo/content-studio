"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, RefreshCw, X, Settings, History, Workflow } from "lucide-react";
import { useProduction } from "./hooks/use-production";
import { StepDetails } from "./components/step-details";
import { LibraryPanel } from "./components/library/panel";
import { ProductionSidebar } from "./components/navigation/production-sidebar";
import { ResearchAccounts } from "@/screens/dashboard/components/settings/research-accounts";
import { useResearchAccounts } from "@/screens/dashboard/components/settings/use-research-accounts";
import type { ProductionStep } from "@/domains/content-production/domain/contracts";
import "./production.css";
const WorkflowCanvas = dynamic(() => import("./components/workflow-canvas").then(m => m.WorkflowCanvas), { ssr: false, loading: () => <div className="production-canvas" /> });
export function ContentProductionScreen({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const { data, error, busy, writes, activity, reload, act } = useProduction();
  const accounts = useResearchAccounts();
  const [count, setCount] = useState(1);
  const [panel, setPanel] = useState<"library" | "settings" | null>(null);
  const [selected, setSelected] = useState<{ id: string; step: ProductionStep } | null>(null);
  const safe = (action: Record<string, unknown>) => { void act(action).catch(() => {}); };
  const current = data?.tasks.find(t => t.id === selected?.id);
  const select = (id: string, step: ProductionStep) => { setPanel(null); setSelected({ id, step }); };
  return <div className="flex h-full min-h-0 overflow-hidden">
    <ProductionSidebar tasks={data?.tasks ?? []} model={data?.settings.model ?? "gpt-5.6-sol"} busy={busy} selectedId={selected?.id}
      onSelect={task => select(task.id, task.current_step)} onAction={safe}
      onLibrary={() => { setPanel("library"); setSelected(null); }} onSettings={() => { setPanel("settings"); setSelected(null); }} />
    <main className="relative min-h-0 min-w-0 flex-1" aria-label="제작 작업 공간">
      <WorkflowCanvas selectedNode={selected ? `${selected.id}:${selected.step}` : undefined} tasks={data?.tasks ?? []} writes={writes} activity={activity} syncing={data?.sync.running ?? false} onSelect={select} onOpen={id => void onOpen(id)} />
      <div className="absolute top-4 left-4 z-10 max-w-[calc(100%-2rem)] rounded-xl border bg-background p-3 shadow-sm">
        <form className="flex flex-wrap items-center gap-2" onSubmit={e => { e.preventDefault(); safe({ action: "start", count }); }}>
          <Workflow size={16} className="mr-2 text-muted-foreground" /><label className="text-xs" htmlFor="production-count">제작 개수</label>
          <input id="production-count" className="production-field !w-16" type="number" min={1} value={count} onChange={e => setCount(Number(e.target.value))} required />
          <button className="production-button primary" disabled={busy || data?.sync.running}><Play size={14} />{data?.sync.running ? "성과 갱신 중" : "시작"}</button>
          <button type="button" className="production-button" aria-label="새로고침" onClick={() => void reload()}><RefreshCw size={14} /></button>
        </form>
        {error && <p role="alert" className="mt-2 max-w-md text-xs text-destructive">{error}</p>}
        {data && !data.configured.apify && <p className="mt-2 text-[11px] text-muted-foreground">Apify 미연결 · 외부 조회에는 APIFY_API_TOKEN이 필요합니다.</p>}
      </div>
      {selected && current && <aside className="absolute inset-y-0 right-0 z-20 w-[420px] max-w-full overflow-y-auto border-l bg-background shadow-lg" aria-label="작업 상세">
        <StepDetails id={selected.id} step={selected.step} updated={current.updated_at} write={writes[`${selected.id}:${selected.step}`] ?? 0} onClose={() => setSelected(null)} />
      </aside>}
      {panel && <section className="absolute inset-0 z-20 flex flex-col bg-background" aria-label={panel === "library" ? "기록과 레퍼런스" : "연결 설정"}>
        <header className="flex shrink-0 items-center justify-between border-b px-6 py-4"><h2 className="flex items-center gap-2 text-sm font-semibold">{panel === "library" ? <><History size={16} />기록과 레퍼런스</> : <><Settings size={16} />연결 설정</>}</h2><button className="production-button" onClick={() => setPanel(null)} aria-label="캔버스로 돌아가기"><X size={14} />닫기</button></header>
        <div className="min-h-0 flex-1 overflow-auto p-6">{panel === "library" && data ? <LibraryPanel logs={data.logs} references={data.references} visuals={data.visuals} act={act} onOpen={id => void onOpen(id)} /> : panel === "settings" ? <ResearchAccounts state={accounts} /> : null}</div>
      </section>}
    </main>
  </div>;
}
