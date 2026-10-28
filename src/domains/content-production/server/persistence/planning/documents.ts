import type Database from "better-sqlite3";
import type { ProductionStep, Row } from "../../../domain/contracts";

/** Keep structured decisions after publication removes the working draft. */
export function readStageDocument(db: Database.Database, logId: string, step: ProductionStep): Row {
  const row = db.prepare("SELECT document_json FROM content_stage_documents WHERE log_id=? AND step=?")
    .get(logId, step) as { document_json: string } | undefined;
  return row ? JSON.parse(row.document_json) as Row : {};
}

export function saveStageDocument(db: Database.Database, logId: string, step: ProductionStep, patch: Row) {
  if (!Object.keys(patch).length) return;
  const document = { ...readStageDocument(db, logId, step), ...patch };
  db.prepare(`INSERT INTO content_stage_documents(log_id,step,document_json) VALUES(?,?,?)
    ON CONFLICT(log_id,step) DO UPDATE SET document_json=excluded.document_json`)
    .run(logId, step, JSON.stringify(document));
}
