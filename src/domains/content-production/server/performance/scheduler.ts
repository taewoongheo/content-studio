import { getLocalDatabase } from "@/lib/local-db/database";
import { backfillPerformance, collectPerformance } from "./collection";

/** Only the single server process owns the timer and in-flight guard. */
const shared = globalThis as typeof globalThis & { performanceTimer?: ReturnType<typeof setInterval> };
export function serializedCollection(collect: () => Promise<void>, onError: (error:unknown) => void) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try { await collect(); }
    catch (error) { onError(error); }
    finally { running = false; }
  };
}
export function startPerformanceCollection() {
  if (shared.performanceTimer) return;
  const tick = serializedCollection(async () => {
    const db = getLocalDatabase();
    if (backfillPerformance(db)) {
      const { notifyProjectsChanged } = await import("@/domains/workspace/server/project-events");
      notifyProjectsChanged();
    }
    if (process.env.APIFY_API_TOKEN?.trim()) await collectPerformance(db);
  }, error => console.error("성과 수집 파이프라인 실패",error));
  shared.performanceTimer = setInterval(() => void tick(),300000);
  shared.performanceTimer.unref();
  void tick();
}
