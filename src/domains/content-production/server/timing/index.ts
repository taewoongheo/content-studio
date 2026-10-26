import type Database from "better-sqlite3";
import type { ProductionStep } from "../../domain/contracts";
import type { TaskTiming } from "../../domain/timing";

// Runtime telemetry belongs to the single server, not authored drafts or AI research.
// Browser reloads retain it; a server restart begins a new telemetry session.
const shared = globalThis as typeof globalThis & {
  productionTiming?: WeakMap<Database.Database, Map<string, TaskTiming>>;
};
const databases = shared.productionTiming ??= new WeakMap();
function tasks(db: Database.Database) {
  let values = databases.get(db);
  if (!values) { values = new Map(); databases.set(db, values); }
  return values;
}

export function readTaskTiming(db: Database.Database, id: string): TaskTiming {
  return structuredClone(tasks(db).get(id) ?? {});
}

export function updateTaskTiming(db: Database.Database, id: string, step: ProductionStep, running: boolean, now: string) {
  const values = tasks(db);
  const timing = values.get(id) ?? {};
  const intervals = timing[step] ?? [];
  const active = intervals.at(-1);
  if (running && active?.ended_at === null) return;
  if (running) intervals.push({ started_at: now, ended_at: null });
  else if (active && active.ended_at === null) active.ended_at = now;
  if (!intervals.length) return;
  timing[step] = intervals;
  values.set(id, timing);
}

export function removeTaskTiming(db: Database.Database, id: string) {
  tasks(db).delete(id);
}
