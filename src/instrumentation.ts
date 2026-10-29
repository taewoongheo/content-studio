export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build"
    || process.env.CONTENT_STUDIO_DISABLE_COLLECTION === "1") return;

  const { startPerformanceCollection } = await import("./domains/content-production/server/performance/scheduler");
  startPerformanceCollection();

  if (process.env.CONTENT_STUDIO_TELEGRAM_ENABLED === "1") {
    const { startTelegram } = await import("./domains/content-production/server/telegram/runtime");
    startTelegram();
  }
}
