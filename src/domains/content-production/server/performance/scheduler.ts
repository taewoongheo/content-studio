import { getLocalDatabase } from "@/lib/local-db/database";
import { collectPerformance } from "./collection";
const shared = globalThis as typeof globalThis & { performanceTimer?: ReturnType<typeof setInterval>; performanceRunning?: boolean };
export function startPerformanceCollection() {
  if (shared.performanceTimer) return;
  const tick = async () => {
    if (shared.performanceRunning || !process.env.APIFY_API_TOKEN) return;
    shared.performanceRunning = true;
    try { await collectPerformance(getLocalDatabase()); }
    catch (error) { console.error("성과 수집 파이프라인 실패",error); }
    finally { shared.performanceRunning = false; }
  };
  shared.performanceTimer = setInterval(() => void tick(),300000);
  shared.performanceTimer.unref();
  void tick();
}
