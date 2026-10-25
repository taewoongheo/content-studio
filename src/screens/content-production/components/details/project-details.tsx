import { useState } from "react";
import { ArrowUpRight, Folder } from "lucide-react";
import type { ProductionStep, WorkDetail, WorkItem } from "@/domains/content-production/domain/contracts";
import { StatusIcon } from "../workflow/status-icon";
import { getStepState, productionSteps } from "../../model/task-controls";

export function ProjectDetails({ task, detail, onSelectStep, onOpen, onClose, onPublish }: {
  task: WorkItem;
  detail?: WorkDetail;
  onSelectStep: (id: string, step: ProductionStep) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onPublish: (url: string) => Promise<unknown>;
}) {
  const finished = task.state === "finished" && !!task.project_id;
  const metadata = detail?.log;
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
      <h3 className="flex min-w-0 items-center gap-2 font-semibold"><Folder size={16} />{finished ? "완성 포스트" : "프로젝트"}</h3>
      <button className="production-button" onClick={onClose}>닫기</button>
    </header>
    <p className="mt-4 text-xs text-muted-foreground">시작 {new Date(task.created_at).toLocaleString("ko-KR")}</p>
    <dl className="mt-5 space-y-4 rounded-lg border p-4">
      {[["소재", metadata?.topic ?? task.topic], ["메시지", metadata?.message], ["포맷", metadata?.content_type ?? task.content_type]].map(([label,value]) =>
        <div key={String(label)}><dt className="text-xs text-muted-foreground">{String(label)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{typeof value === "string" && value.trim() ? value : detail ? "미입력" : "불러오는 중…"}</dd></div>)}
    </dl>
    {finished && <form className="mt-5 space-y-3" onSubmit={publish}>
      <label className="block text-sm font-medium" htmlFor={`publish-${task.id}`}>TikTok 게시물 URL</label>
      <input id={`publish-${task.id}`} name="post_url" className="production-field" type="url" aria-label="게시 URL" placeholder="업로드한 TikTok URL" value={url} onChange={event => setUrl(event.target.value)} required disabled={publishing} />
      <button className="production-button primary w-full" disabled={publishing}>{publishing ? "게시 확인 중…" : "게시 완료"}</button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>}
    {task.project_id && <button className="production-button mt-5" onClick={() => onOpen(task.project_id!)}>편집기로 열기<ArrowUpRight size={14} /></button>}
    <div className="mt-6 space-y-3">
      {productionSteps.map(({ id: step, label }, index) => {
        const state = getStepState(task, step);
        return <button key={step} className="flex w-full items-center gap-3 rounded-lg border p-4 text-left hover:bg-muted/50" onClick={() => onSelectStep(task.id, step)}>
          <StatusIcon state={state} size={18} /><span className="flex-1"><span className="block text-xs text-muted-foreground">단계 {index + 1}</span><span className="mt-1 block text-sm font-medium">{label}</span></span><ArrowUpRight size={16} />
        </button>;
      })}
    </div>

  </section>;
}
