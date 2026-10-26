export const metricKeys = ["view_count", "like_count", "save_count", "comment_count", "share_count"] as const;
export type PerformanceRecord = Record<typeof metricKeys[number], number | null> & {
  log_id: string; project_id: string | null; name: string; post_url: string;
  actual_published_at: string; observed_at: string | null;
};
export type PerformanceRefresh = {
  started_at: string; completed_at: string | null; state: "running" | "completed" | "failed";
  records: PerformanceRecord[]; error: string | null;
};
export function recentKoreanDate(iso: string, now = new Date()) {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
  return day(new Date(iso)) >= day(new Date(now.getTime() - 3 * 86400000)) && day(new Date(iso)) <= day(now);
}
