import type Database from "better-sqlite3";
import { metricKeys, performanceStage, type StagePerformance } from "../../domain/performance";

type PerformanceMetrics = Omit<StagePerformance, "stage">;

export function updateLatestPerformance(
  db: Database.Database,
  id: string,
  post: PerformanceMetrics,
  observedAt = new Date().toISOString(),
) {
  db.prepare(`UPDATE content_creation_logs SET ${metricKeys.map(key => `${key}=?`).join(",")},observed_at=?,updated_at=? WHERE id=?`)
    .run(...metricKeys.map(key => post[key]), observedAt, observedAt, id);
}

function insertStage(db: Database.Database, id: string, stage: StagePerformance["stage"], post: PerformanceMetrics) {
  return db.prepare(`INSERT OR IGNORE INTO content_performance(log_id,stage,${metricKeys.join(",")})
    VALUES(?,?,?,?,?,?,?)`).run(id, stage, ...metricKeys.map(key => post[key])).changes;
}

export function savePerformance(db: Database.Database, id: string, post: PerformanceMetrics, now = Date.now()) {
  const log = db.prepare("SELECT actual_published_at FROM content_creation_logs WHERE id=?")
    .get(id) as { actual_published_at: string } | undefined;
  const stage = log && performanceStage(log.actual_published_at, now);
  return stage ? insertStage(db, id, stage, post) : 0;
}

/** Historical latest values belong to the stage when they were observed. */
export function backfillPerformance(db: Database.Database) {
  const rows = db.prepare(`SELECT id,actual_published_at,observed_at,${metricKeys.join(",")}
    FROM content_creation_logs WHERE post_url IS NOT NULL AND observed_at IS NOT NULL`)
    .all() as Array<PerformanceMetrics & { id: string; actual_published_at: string; observed_at: string }>;
  return db.transaction(() => {
    let changes = 0;
    for (const row of rows) {
      const stage = performanceStage(row.actual_published_at, Date.parse(row.observed_at));
      if (stage && metricKeys.some(key => row[key] !== null)) {
        changes += insertStage(db, row.id, stage, row);
      }
    }
    return changes;
  })();
}
