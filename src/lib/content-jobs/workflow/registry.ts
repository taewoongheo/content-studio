import { randomUUID } from "node:crypto";
import { createBlankDocument } from "../editor/document";
import type { ContentJobInput, ContentJobRecord, ContentJobSnapshot, OpenProjectTab } from "../domain/types";
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
  private tabListeners = new Set<(tabs: OpenProjectTab[]) => void>();
  private closeListeners = new Map<string, Set<() => void>>();
  private pending: { before: Map<string, ContentJobRecord | null>; committed: Array<() => void> } | null = null;
  private readonly createId: () => string;
  private readonly now: () => Date;
  constructor(options: RegistryOptions = {}) {
    this.createId = options.createId ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }
  add(input: ContentJobInput, id = this.createId()) {
    if (this.has(id)) return this.get(id);
    const timestamp = this.now().toISOString();
    const job: ContentJobRecord = {
      ...structuredClone(input), id, tabId: randomUUID(),
      editor: { revision: 0, document: createBlankDocument(input) },
      editorHistory: [], assets: [], createdAt: timestamp, updatedAt: timestamp,
    };
    this.remember(id);
    this.jobs.set(id, job);
    if (!this.pending) this.publish(id);
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
    if (!this.pending) this.publish(id);
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
    for (const id of pending.before.keys()) this.publish(id);
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
  subscribe(id: string, listener: JobListener, onClose?: () => void) {
    this.getRecord(id);
    const listeners = this.listeners.get(id) ?? new Set<JobListener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    const closed = this.closeListeners.get(id) ?? new Set<() => void>();
    if (onClose) { closed.add(onClose); this.closeListeners.set(id, closed); }
    return () => {
      if (onClose) closed.delete(onClose);
      if (!closed.size) this.closeListeners.delete(id);
      listeners.delete(listener);
      if (!listeners.size) this.listeners.delete(id);
    };
  }
  private snapshot(job: ContentJobRecord): ContentJobSnapshot {
    return structuredClone({
      id: job.id, tabId: job.tabId, name: job.name, savedRevision: job.savedRevision, structure: job.structure, aspectRatio: job.aspectRatio,
      slideCount: job.slideCount, outputLanguage: job.outputLanguage,
      editor: job.editor, assets: job.assets, createdAt: job.createdAt, updatedAt: job.updatedAt,
    });
  }
  requireTab(id: string, tabId: string) {
    const job = this.getRecord(id);
    if (job.tabId !== tabId) throw new ContentJobError("INVALID_STAGE", "이 탭은 종료되었습니다. 다시 열린 탭의 최신 상태를 읽어 주세요.");
    return job;
  }
  tabs(): OpenProjectTab[] {
    return [...this.jobs.values()].map(job => ({ tabId: job.tabId, projectId: job.id,
      name: job.name ?? "새 프로젝트", revision: job.editor.revision, savedRevision: job.savedRevision }));
  }
  subscribeTabs(listener: (tabs: OpenProjectTab[]) => void) {
    this.tabListeners.add(listener);
    return () => { this.tabListeners.delete(listener); };
  }
  remove(id: string) {
    this.getRecord(id);
    this.remember(id);
    this.jobs.delete(id);
    if (!this.pending) this.publish(id);
  }
  private publish(id: string) {
    const job = this.jobs.get(id);
    if (job) this.emit(job);
    else {
      for (const close of [...this.closeListeners.get(id) ?? []]) close();
      this.closeListeners.delete(id);
      this.listeners.delete(id);
    }
    for (const listener of this.tabListeners) listener(this.tabs());
  }
  private emit(job: ContentJobRecord) {
    for (const listener of this.listeners.get(job.id) ?? []) listener(this.snapshot(job));
  }
}
