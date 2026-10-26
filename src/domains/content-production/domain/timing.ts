import { productionSteps, type ProductionStep, type WorkDetail } from "./contracts";

export interface ExecutionInterval {
  started_at: string;
  ended_at: string | null;
  estimated?: boolean;
}
export type TaskTiming = Partial<Record<ProductionStep, ExecutionInterval[]>>;

/** Merge overlaps so parallel execution is counted once in the overall timer. */
export function executionMilliseconds(intervals: ExecutionInterval[], now: number): number {
  const ranges = intervals.map(interval => [Date.parse(interval.started_at), interval.ended_at ? Date.parse(interval.ended_at) : now])
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end >= start)
    .sort((a, b) => a[0] - b[0]);
  let total = 0, end = -Infinity;
  for (const [start, nextEnd] of ranges) {
    total += Math.max(0, nextEnd - Math.max(start, end));
    end = Math.max(end, nextEnd);
  }
  return total;
}

export function formatExecutionTime(milliseconds: number): string {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Retained completed drafts still have a duration when runtime telemetry is unavailable. */
export function stageExecutionIntervals(detail: WorkDetail | undefined, step: ProductionStep): ExecutionInterval[] {
  const recorded = detail?.timing?.[step];
  if (recorded?.length) return recorded;
  const draft = detail?.[step];
  if (typeof draft?.created_at !== "string" || typeof draft.completed_at !== "string") return [];
  const start = Date.parse(draft.created_at), end = Date.parse(draft.completed_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  return [{ started_at: draft.created_at, ended_at: draft.completed_at, estimated: true }];
}

export function taskExecutionIntervals(detail: WorkDetail | undefined): ExecutionInterval[] {
  return productionSteps.flatMap(({ id }) => stageExecutionIntervals(detail, id));
}
