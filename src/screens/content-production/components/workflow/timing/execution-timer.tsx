"use client";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { executionMilliseconds, formatExecutionTime, type ExecutionInterval } from "@/domains/content-production/domain/timing";

/** Only this small readout ticks; graph data, layout and viewport remain unchanged. */
export function ExecutionTimer({ intervals, label }: { intervals: ExecutionInterval[]; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const running = intervals.some(interval => interval.ended_at === null);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  if (!intervals.length) return null;
  return <span className="inline-flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-muted-foreground" title="실제 실행 시간 · 중단 시간 제외" aria-label={label || "실행 시간"}>
    <Timer size={13} aria-hidden="true" />
    {label && <span>{label}</span>}
    <span>{formatExecutionTime(executionMilliseconds(intervals, now))}</span>
  </span>;
}
