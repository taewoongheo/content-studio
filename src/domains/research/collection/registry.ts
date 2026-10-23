import { randomUUID } from "node:crypto";
import { evaluateCriteria } from "@/domains/research/domain/schema";
import { CollectionBlocked, type Collector, type CollectionRequest, type CollectionResult } from "@/domains/research/collection/types";

type Job = { id: string; sessionId: string; request: CollectionRequest;
  status: "running" | "complete" | "blocked" | "cancelled";
  createdAt: number; controller: AbortController; attempt: number;
  result?: CollectionResult; block?: { reason: string; message: string } };
type Session = { platform: string; touchedAt: number; closed: boolean };
const SESSION_TTL = 30 * 60_000;
export class CollectionRegistry {
  private jobs = new Map<string, Job>();
  private sessions = new Map<string, Session>();
  private expirationTimer?: NodeJS.Timeout;
  constructor(private collect: Collector, private onClose: (sessionId: string) => void = () => {}) {}
  start(request: CollectionRequest, sessionId?: string) {
    if (request.source.platform !== "youtube") throw new Error("Use Apify production tools for TikTok research. This collector supports YouTube only.");
    this.expire();
    if (this.jobs.size >= 64) throw new Error("Close collection sessions before starting more jobs.");
    const id = sessionId ?? randomUUID();
    const session = this.sessions.get(id);
    if (sessionId && (!session || session.closed)) throw new Error("Unknown or closed collection session.");
    if (session && session.platform !== request.source.platform) throw new Error("A collection session belongs to one platform.");
    if ([...this.jobs.values()].some(job => job.sessionId === id && job.status === "running"))
      throw new Error("Wait for the current collection in this session before starting another.");
    this.sessions.set(id, { platform: request.source.platform, touchedAt: Date.now(), closed: false });
    if (!this.expirationTimer) {
      this.expirationTimer = setInterval(() => this.expire(), 60_000);
      this.expirationTimer.unref();
    }
    const job: Job = { id: randomUUID(), sessionId: id, request, status: "running", createdAt: Date.now(), controller: new AbortController(), attempt: 1 };
    this.jobs.set(job.id, job); void this.run(job);
    return this.snapshot(job.id);
  }
  private async run(job: Job) {
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CollectionBlocked("timeout", "The research operation exceeded 60 seconds."));
          job.controller.abort();
        }, 60_000); timer.unref();
      });
      const result = await Promise.race([timeout, this.collect(job.request, {
        sessionId: job.sessionId, signal: job.controller.signal,
      })]);
      if (job.status === "cancelled") return;
      job.result = result; job.status = "complete";
    } catch (error) {
      if (job.status === "cancelled") return;
      job.status = "blocked";
      job.block = error instanceof CollectionBlocked ? { reason: error.reason, message: error.message } :
        { reason: "source_error", message: "The source did not return usable data." };
    } finally {
      clearTimeout(timer);
    }
  }
  snapshot(id: string) {
    this.expire();
    const job = this.jobs.get(id);
    if (!job) throw new Error("Unknown or expired collection job.");
    const session = this.sessions.get(job.sessionId);
    if (session) session.touchedAt = Date.now();
    return { jobId: job.id, sessionId: job.sessionId, status: job.status, attempt: job.attempt,
      sourceUrl: job.request.source.url, kind: job.request.kind,
      ...(job.request.search ? { search: job.request.search } : {}),
      criteria: job.request.criteria ?? {},
      ...(job.block ? { block: job.block } : {}),
      ...(job.result ? { ...job.result, posts: job.result.posts.map(post => ({ ...post,
        criteriaEvaluation: evaluateCriteria(post, job.request.criteria) })) } : {}),
      expiresAfterInactivityMs: SESSION_TTL };
  }
  resume(id: string) {
    this.snapshot(id);
    const job = this.jobs.get(id)!;
    if (job.status !== "blocked") throw new Error("Only a blocked collection can be resumed.");
    if ([...this.jobs.values()].some(other => other.sessionId === job.sessionId && other.status === "running"))
      throw new Error("Wait for the current collection in this session before resuming another job.");
    if (job.attempt >= 3) throw new Error("This job reached its three-attempt retry limit. Close the session or start a new bounded request.");
    job.status = "running"; job.block = undefined; job.attempt++;
    job.controller = new AbortController(); void this.run(job);
    return this.snapshot(id);
  }
  getPost(jobId: string, postId: string) {
    const snapshot = this.snapshot(jobId);
    const job = this.jobs.get(jobId)!;
    if (snapshot.status !== "complete") throw new Error("Wait for a complete collection before reading its images.");
    const post = job.result?.posts.find(post => post.id === postId);
    if (!post) throw new Error("The post is not part of this collection.");
    return post;
  }
  async close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return { sessionId, closed: true };
    session.closed = true;
    for (const [id, job] of this.jobs) if (job.sessionId === sessionId) {
      job.controller.abort(); job.status = "cancelled"; this.jobs.delete(id);
    }
    this.onClose(sessionId);
    this.sessions.delete(sessionId);
    if (!this.sessions.size) { clearInterval(this.expirationTimer); this.expirationTimer = undefined; }
    return { sessionId, closed: true };
  }
  private expire() {
    for (const [id, session] of this.sessions) if (!session.closed && Date.now() - session.touchedAt > SESSION_TTL)
      void this.close(id).catch(() => undefined);
  }
}
