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
    this.jobs.set(id, job);
    this.emit(job);
    return this.snapshot(job);
  }
  has(id: string) { return this.jobs.has(id); }
  get(id: string) { return this.snapshot(this.getRecord(id)); }
  getRecord(id: string) {
    const job = this.jobs.get(id);
    if (!job) throw new ContentJobError("JOB_NOT_FOUND", "작업을 찾을 수 없습니다. 저장된 프로젝트를 다시 열어 주세요.");
    return job;
  }
  update(id: string, update: (job: ContentJobRecord) => void) {
    const job = this.getRecord(id);
    update(job);
    job.updatedAt = this.now().toISOString();
    this.emit(job);
    return this.snapshot(job);
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
      id: job.id, structure: job.structure, aspectRatio: job.aspectRatio,
      slideCount: job.slideCount, outputLanguage: job.outputLanguage,
      editor: job.editor, assets: job.assets, createdAt: job.createdAt, updatedAt: job.updatedAt,
    });
  }
  private emit(job: ContentJobRecord) {
    for (const listener of this.listeners.get(job.id) ?? []) listener(this.snapshot(job));
  }
}
