export const metricKeys = ["view_count", "like_count", "save_count", "comment_count", "share_count"] as const;
export type PerformanceRecord = Record<typeof metricKeys[number], number | null> & {
  log_id: string; project_id: string | null; name: string; post_url: string;
  actual_published_at: string; observed_at: string | null;
};
export type PerformanceRefresh = {
  started_at: string; completed_at: string | null; state: "running" | "completed" | "failed";
  records: PerformanceRecord[]; error: string | null;
};
export type StagePerformance = Record<typeof metricKeys[number], number | null> & {
  stage: "early" | "middle" | "late";
};

export const performanceStages = [
  { stage: "early", minDays: 1, label: "초기 · 1–3일" },
  { stage: "middle", minDays: 3, label: "중기 · 3–7일" },
  { stage: "late", minDays: 7, label: "후기 · 7일 이후" },
] as const;

export function performanceStage(publishedAt: string, now = Date.now()): StagePerformance["stage"] | null {
  const days = (now - Date.parse(publishedAt)) / 86400000;
  return performanceStages.findLast(stage => days >= stage.minDays)?.stage ?? null;
}
