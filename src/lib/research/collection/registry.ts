import type { AccountManager } from "../accounts/manager";
import type { AccountPlatform } from "../accounts/types";
import { randomUUID } from "node:crypto";
import { ResearchBrowsers } from "../browser/sessions";
import { evaluateCriteria } from "../domain/schema";
import { CollectionBlocked, type Collector, type CollectionRequest, type CollectionResult } from "./types";

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
  readonly browsers: ResearchBrowsers;
  constructor(private collect: Collector, private onClose: (sessionId: string) => void = () => {},
    private accounts?: AccountManager) { this.browsers = accounts?.browsers ?? new ResearchBrowsers(); }
  start(request: CollectionRequest, sessionId?: string) {
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
    const platform = job.request.source.platform;
    const authenticatedPlatform = platform === "youtube" ? undefined : platform as AccountPlatform;
    let release: (() => void) | undefined;
    let timer: NodeJS.Timeout | undefined;
    this.browsers.hold(job.sessionId);
    try {
      if (authenticatedPlatform && this.accounts) {
        if (job.request.kind === "search") this.accounts.require(authenticatedPlatform);
        release = this.accounts.acquire(authenticatedPlatform, job.id, () => {
          job.controller.abort(); job.status = "cancelled";
          void this.browsers.close(job.sessionId).catch(() => undefined);
          job.block = { reason: "login_required", message: "The account was disconnected in Dashboard → Settings." };
        });
      }
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new CollectionBlocked("timeout", "The research operation exceeded 60 seconds."));
          job.controller.abort(); void this.browsers.close(job.sessionId).catch(() => undefined);
        }, 60_000); timer.unref();
      });
      const result = await Promise.race([timeout, this.collect(job.request, {
        sessionId: job.sessionId, signal: job.controller.signal,
        authState: authenticatedPlatform ? this.accounts?.store.load(authenticatedPlatform) : undefined,
        getPage: () => this.browsers.page(job.sessionId, authenticatedPlatform),
      })]);
      if (job.status === "cancelled") return;
      job.result = result; job.status = "complete";
      await this.browsers.save(job.sessionId).catch(() => undefined);
    } catch (error) {
      if (job.status === "cancelled") return;
      job.status = "blocked";
      job.block = error instanceof CollectionBlocked ? { reason: error.reason, message: error.message } :
        { reason: "source_error", message: "The source did not return usable data. No CAPTCHA was confirmed." };
      if (job.block.reason === "login_required" && authenticatedPlatform && this.accounts?.store.status(authenticatedPlatform).status === "connected")
        await this.accounts.rejected(authenticatedPlatform).catch(() => undefined);
    } finally {
      clearTimeout(timer); release?.();
      this.browsers.release(job.sessionId, job.block?.reason === "captcha_required");
      if (job.status !== "complete" && job.block?.reason !== "captcha_required")
        await this.browsers.close(job.sessionId).catch(() => undefined);
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
      ...(job.request.source.platform !== "youtube" && this.accounts ? { account: this.accounts.status(job.request.source.platform) } : {}),
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
  async openBrowser(id: string) {
    this.snapshot(id);
    const job = this.jobs.get(id)!;
    if (job.status === "running") throw new Error("Wait until the collection stops before taking browser control.");
    if (job.request.source.platform === "youtube" || (job.request.source.platform === "instagram" && job.request.kind !== "search"))
      throw new Error("Browser handoff supports TikTok and Instagram search. Instagram collection uses Python HTTP and YouTube uses InnerTube.");
    const page = this.browsers.peek(job.sessionId);
    if (!page || page.isClosed()) throw new Error("The collection browser is closed; the original session cannot be handed off.");
    await page.bringToFront();
    return { sessionId: job.sessionId, jobId: id, page, url: page.url(),
      browserName: "Google Chrome for Testing", instruction: "Operate this existing visible Chromium window with computer use. Do not open a fresh browser. Then call resume_collection; successful collection confirms recovery." };
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
    try { await this.browsers.close(sessionId); } finally {
      this.sessions.delete(sessionId);
      if (!this.sessions.size) { clearInterval(this.expirationTimer); this.expirationTimer = undefined; }
    }
    return { sessionId, closed: true };
  }
  private expire() {
    for (const [id, session] of this.sessions) if (!session.closed && Date.now() - session.touchedAt > SESSION_TTL)
      void this.close(id).catch(() => undefined);
  }
}
