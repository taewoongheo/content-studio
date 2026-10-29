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
