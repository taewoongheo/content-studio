import { randomUUID } from "node:crypto";
import { createContentJobState } from "./domain";
import type {
  ContentJobInput,
  ContentJobOperation,
  ContentJobRecord,
  ContentJobSnapshot,
} from "./types";

export type ContentJobErrorCode =
  | "JOB_NOT_FOUND"
  | "OPERATION_IN_PROGRESS"
  | "CODEX_UNAVAILABLE"
  | "INVALID_OUTPUT"
  | "INVALID_STAGE";

export class ContentJobError extends Error {
  constructor(
    readonly code: ContentJobErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContentJobError";
  }
}

type RegistryOptions = {
  createId?: () => string;
  now?: () => Date;
};

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

  add(input: ContentJobInput, threadId: string) {
    const timestamp = this.now().toISOString();
    const job: ContentJobRecord = {
      ...structuredClone(input),
      id: this.createId(),
      threadId,
      state: createContentJobState(),
      activeOperation: null,
      lastError: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.jobs.set(job.id, job);
    this.emit(job);
    return this.snapshot(job);
  }

  get(id: string) {
    return this.snapshot(this.require(id));
  }

  getRecord(id: string) {
    return this.require(id);
  }

  update(id: string, update: (job: ContentJobRecord) => void) {
    const job = this.require(id);
    update(job);
    job.updatedAt = this.now().toISOString();
    this.emit(job);
    return this.snapshot(job);
  }

  async runExclusive<Result>(
    id: string,
    operation: ContentJobOperation,
    task: (job: ContentJobRecord) => Promise<Result>,
  ): Promise<Result> {
    const job = this.require(id);
    if (job.activeOperation) {
      throw new ContentJobError(
        "OPERATION_IN_PROGRESS",
        "이 작업에서 다른 AI 생성이 진행 중입니다.",
      );
    }
    this.update(id, (current) => {
      current.activeOperation = operation;
      current.lastError = null;
    });
    try {
      return await task(job);
    } catch (error) {
      this.update(id, (current) => {
        current.lastError =
          error instanceof Error ? error.message : "작업을 완료하지 못했습니다.";
      });
      throw error;
    } finally {
      this.update(id, (current) => {
        current.activeOperation = null;
      });
    }
  }

  subscribe(id: string, listener: JobListener) {
    this.require(id);
    const listeners = this.listeners.get(id) ?? new Set<JobListener>();
    listeners.add(listener);
    this.listeners.set(id, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.listeners.delete(id);
    };
  }

  private require(id: string) {
    const job = this.jobs.get(id);
    if (!job) {
      throw new ContentJobError(
        "JOB_NOT_FOUND",
        "작업을 찾을 수 없습니다. 서버가 재시작되었다면 새 작업을 만들어 주세요.",
      );
    }
    return job;
  }

  private snapshot(job: ContentJobRecord): ContentJobSnapshot {
    const value = structuredClone(job);
    return {
      id: value.id,
      productContext: value.productContext,
      aspectRatio: value.aspectRatio,
      slideCount: value.slideCount,
      outputLanguage: value.outputLanguage,
      state: value.state,
      activeOperation: value.activeOperation,
      lastError: value.lastError,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      referenceImages: value.referenceImages.map((image) => ({
        id: image.id,
        name: image.name,
        type: image.type,
        size: image.size,
      })),
    };
  }

  private emit(job: ContentJobRecord) {
    const snapshot = this.snapshot(job);
    for (const listener of this.listeners.get(job.id) ?? []) listener(snapshot);
  }
}
