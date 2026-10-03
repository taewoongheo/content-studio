import { randomUUID } from "node:crypto";
import { createBlankDocument } from "../editor/document";
import type { ContentJobInput, ContentJobRecord, ContentJobSnapshot } from "../domain/types";
export type ContentJobErrorCode = "JOB_NOT_FOUND" | "INVALID_OUTPUT" | "INVALID_STAGE";
export class ContentJobError extends Error {
  constructor(readonly code: ContentJobErrorCode, message: string) {
    super(message);
    this.name = "ContentJobError";
  }
}
type RegistryOptions = { createId?: () => string; now?: () => Date };
type JobListener = (snapshot: ContentJobSnapshot) => void;
export class ContentJobRegistry {
  private jobs = new Map<string, ContentJobRecord>();
  private listeners = new Map<string, Set<JobListener>>();
  private pending: { before: Map<string, ContentJobRecord | null>; committed: Array<() => void> } | null = null;
  private readonly createId: () => string;
  private readonly now: () => Date;
  constructor(options: RegistryOptions = {}) {
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }
  add(input: ContentJobInput, id = this.createId()) {
    const timestamp = this.now().toISOString();
    const job: ContentJobRecord = {
      ...structuredClone(input), id,
      editor: { revision: 0, document: createBlankDocument(input) },
      editorHistory: [], assets: [], createdAt: timestamp, updatedAt: timestamp,
    };
    this.remember(id);
    this.jobs.set(id, job);
    if (!this.pending) this.emit(job);
    return this.snapshot(job);
  }
  has(id: string) { return this.jobs.has(id); }
  list() { return [...this.jobs.values()].map((job) => this.snapshot(job)); }
  get(id: string) { return this.snapshot(this.getRecord(id)); }
  getRecord(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new ContentJobError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다. 저장된 프로젝트를 다시 열어 주세요.");
    return job;
  }
  update(id: string, update: (job: ContentJobRecord) => void) {
    const job = this.getRecord(id);
    this.remember(id);
    update(job);
    job.updatedAt = this.now().toISOString();
    if (!this.pending) this.emit(job);
    return this.snapshot(job);
  }
  /** Synchronous writes only: defer notifications until persistence commits, restore on failure. */
  transaction<T>(operation: () => T): T {
    if (this.pending) return operation();
    const pending = { before: new Map<string, ContentJobRecord | null>(), committed: [] as Array<() => void> };
    this.pending = pending;
    let result: T;
    try { result = operation(); }
    catch (error) {
      for (const [id, before] of pending.before) {
        if (before) this.jobs.set(id, before);
        else this.jobs.delete(id);
      }
      throw error;
    } finally { this.pending = null; }
    for (const id of pending.before.keys()) this.emit(this.getRecord(id));
    for (const action of pending.committed) action();
    return result;
  }
  afterCommit(action: () => void) {
    if (this.pending) this.pending.committed.push(action);
    else action();
  }
  private remember(id: string) {
    if (this.pending && !this.pending.before.has(id))
      this.pending.before.set(id, this.jobs.has(id) ? structuredClone(this.getRecord(id)) : null);
  }
  subscribe(id: string, listener: JobListener) {
    this.getRecord(id);
    const listeners = this.listeners.get(id) ?? new Set<JobListener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(id);
    };
  }
  private snapshot(job: ContentJobRecord): ContentJobSnapshot {
    return structuredClone({
      id: job.id, name: job.name, savedRevision: job.savedRevision, structure: job.structure, aspectRatio: job.aspectRatio,
      slideCount: job.slideCount, outputLanguage: job.outputLanguage,
      editor: job.editor, assets: job.assets, createdAt: job.createdAt, updatedAt: job.updatedAt,
    });
  }
  private emit(job: ContentJobRecord) {
    for (const listener of this.listeners.get(job.id) ?? []) listener(this.snapshot(job));
  }
}
