import { randomUUID } from "node:crypto";

export type RenderResult = { outputPath: string; bytes: number };
export type RenderJob = {
  jobId: string; projectId: string; projectType: "slideshow" | "video"; revision: number;
  status: "queued" | "running" | "cancelling" | "cancelled" | "completed" | "failed";
  progress: number; phase: string; createdAt: string; updatedAt: string;
  result?: RenderResult; error?: string;
};
type Entry = { job: RenderJob; controller: AbortController; finishedAt?: number };
export type RenderContext = { signal: AbortSignal; progress: (progress: number, phase: string) => void };
const terminal = (job: RenderJob) => ["completed", "failed", "cancelled"].includes(job.status);

/** Jobs survive individual MCP requests; completed metadata is bounded and never contains media bytes. */
export class RenderJobs {
  private entries = new Map<string, Entry>();
  constructor(private readonly retentionMs = 15 * 60_000, private readonly maxCompleted = 40) {}
  private prune() {
    const completed = [...this.entries.values()].filter(entry => entry.finishedAt !== undefined);
    for (const [index, entry] of completed.entries()) {
      if (Date.now() - entry.finishedAt! >= this.retentionMs || index < completed.length - this.maxCompleted)
        this.entries.delete(entry.job.jobId);
    }
  }
  start(input: Pick<RenderJob, "projectId" | "projectType" | "revision">, run: (context: RenderContext) => Promise<RenderResult>) {
    this.prune();
    if ([...this.entries.values()].filter(entry => !terminal(entry.job)).length >= 8)
      throw new Error("대기 중인 렌더링 작업이 많습니다. 완료하거나 취소한 뒤 다시 요청해 주세요.");
    const now = new Date().toISOString();
    const entry: Entry = { controller: new AbortController(), job: { ...input, jobId: randomUUID(), status: "queued", progress: 0, phase: "queued", createdAt: now, updatedAt: now } };
    this.entries.set(entry.job.jobId, entry);
    // Defer work so clients receive the job ID before any rendering begins.
    queueMicrotask(() => { void this.run(entry, run); });
    return structuredClone(entry.job);
  }
  private async run(entry: Entry, run: (context: RenderContext) => Promise<RenderResult>) {
    try {
      entry.controller.signal.throwIfAborted();
      entry.job.status = "running";
      const result = await run({ signal: entry.controller.signal, progress: (progress, phase) => {
        if (entry.controller.signal.aborted) return;
        entry.job.progress = Math.max(entry.job.progress, Math.min(1, Math.max(0, progress)));
        entry.job.phase = phase; entry.job.updatedAt = new Date().toISOString();
      } });
      // Export publication is the commit point: a late cancel must not hide a written result.
      entry.job.result = result; entry.job.progress = 1; entry.job.phase = "completed"; entry.job.status = "completed";
    } catch (error) {
      entry.job.status = entry.controller.signal.aborted ? "cancelled" : "failed";
      entry.job.phase = entry.job.status;
      if (!entry.controller.signal.aborted) entry.job.error = error instanceof Error ? error.message : "렌더링에 실패했습니다.";
    } finally {
      entry.finishedAt = Date.now(); entry.job.updatedAt = new Date().toISOString(); this.prune();
    }
  }
  get(jobId: string) {
    this.prune();
    const entry = this.entries.get(jobId);
    if (!entry) throw new Error("렌더링 작업이 없거나 보관 시간이 만료되었습니다. 서버 재시작 시 작업 기록은 초기화됩니다.");
    return structuredClone(entry.job);
  }
  cancel(jobId: string) {
    this.get(jobId);
    const entry = this.entries.get(jobId)!;
    if (!terminal(entry.job)) {
      entry.job.status = "cancelling"; entry.job.phase = "cancelling";
      entry.job.updatedAt = new Date().toISOString(); entry.controller.abort(new Error("렌더링 작업을 취소했습니다."));
    }
    return structuredClone(entry.job);
  }
}
const state = globalThis as typeof globalThis & { contentStudioRenderJobs?: RenderJobs };
export const renderJobs = state.contentStudioRenderJobs ??= new RenderJobs();
