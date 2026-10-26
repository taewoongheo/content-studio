"use client";
import { Panel } from "@xyflow/react";
import type { WorkDetail } from "@/domains/content-production/domain/contracts";
import type { PerformanceRefresh } from "@/domains/content-production/domain/performance";
import type { ExecutionInterval } from "@/domains/content-production/domain/timing";
import { ExecutionTimer } from "./execution-timer";

export function WorkflowTimer({ details, report }: { details: Record<string, WorkDetail>; report: PerformanceRefresh | null }) {
  const intervals: ExecutionInterval[] = Object.values(details).flatMap(detail => Object.values(detail.timing ?? {}).flat());
  if (report) intervals.push({ started_at: report.started_at, ended_at: report.completed_at });
  if (!intervals.length) return null;
  return <Panel position="top-right" className="rounded-lg border bg-background px-3 py-2 shadow-sm">
    <ExecutionTimer intervals={intervals} label="전체 실행" />
  </Panel>;
}
