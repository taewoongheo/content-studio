import { useState } from "react";
import { ArrowUpRight, Folder } from "lucide-react";
import type { ProductionStep, WorkItem } from "@/domains/content-production/domain/contracts";
import { StatusIcon } from "../workflow/status-icon";
import { getStepState, productionSteps } from "../../model/task-controls";

export function ProjectDetails({ task, onSelectStep, onOpen, onClose, onPublish }: {
  task: WorkItem;
  onSelectStep: (id: string, step: ProductionStep) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onPublish: (url: string) => Promise<unknown>;
}) {
  const [url, setUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (publishing) return;
    setPublishing(true); setError("");
    try { await onPublish(url); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "게시 실패"); }
    finally { setPublishing(false); }
  }
  return <section className="p-5" aria-label="프로젝트 개요">
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Folder size={14} />프로젝트</p><h3 className="mt-2 break-words font-semibold">{task.topic ?? "소재 분석 중"}</h3></div>
      <button className="production-button" onClick={onClose}>닫기</button>
    </header>
    <p className="mt-4 text-xs text-muted-foreground">시작 {new Date(task.created_at).toLocaleString("ko-KR")}</p>
    <div className="mt-6 space-y-3">
      {productionSteps.map(({ id: step, label }, index) => {
        const state = getStepState(task, step);
        return <button key={step} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left hover:bg-muted/50" onClick={() => onSelectStep(task.id, step)}>
          <StatusIcon state={state} size={18} /><span className="flex-1"><span className="block text-xs text-muted-foreground">단계 {index + 1}</span><span className="mt-1 block text-sm font-medium">{label}</span></span><ArrowUpRight size={16} />
        </button>;
      })}
    </div>
    {task.project_id && <button className="production-button mt-5" onClick={() => onOpen(task.project_id!)}>포스트 열기<ArrowUpRight size={14} /></button>}
    {task.state === "finished" && task.project_id && <form className="mt-5 space-y-3" onSubmit={publish}>
      <input className="production-field" type="url" aria-label="게시 URL" placeholder="업로드한 TikTok URL" value={url} onChange={event => setUrl(event.target.value)} required disabled={publishing} />
      <button className="production-button primary" disabled={publishing}>{publishing ? "게시 확인 중…" : "게시"}</button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>}
  </section>;
}
