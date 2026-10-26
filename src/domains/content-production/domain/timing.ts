import type { ProductionStep } from "./contracts";

export interface ExecutionInterval {
  started_at: string;
  ended_at: string | null;
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
