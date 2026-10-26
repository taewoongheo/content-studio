import type Database from "better-sqlite3";
import { EXTERNAL_CONTEXT, externalRecord, readExternalContext, type ExternalContext, type ReferenceStep } from "../../domain/references/context";
import { publishChange } from "../events";

export function getReferenceContext(db: Database.Database, id: string, step: ReferenceStep) {
  const row = db.prepare(`SELECT research_json FROM content_${step}_drafts WHERE draft_id=?`).get(id) as { research_json: string } | undefined;
  if (!row) throw new Error("현재 단계의 draft가 없습니다.");
  return readExternalContext(JSON.parse(row.research_json));
}
export function saveReferenceContext(db: Database.Database, id: string, step: ReferenceStep, context: ExternalContext) {
  const row = db.prepare(`SELECT research_json FROM content_${step}_drafts WHERE draft_id=?`).get(id) as { research_json: string } | undefined;
  if (!row) throw new Error("제거된 작업에는 참고 자료를 저장할 수 없습니다.");
  const research = JSON.parse(row.research_json).filter((entry: { question: string }) => entry.question !== EXTERNAL_CONTEXT);
  research.push(externalRecord(context));
  const now = new Date().toISOString();
  db.prepare(`UPDATE content_${step}_drafts SET research_json=?,updated_at=? WHERE draft_id=?`).run(JSON.stringify(research), now, id);
  db.prepare("UPDATE content_drafts SET updated_at=? WHERE id=?").run(now, id);
  publishChange({ kind: "saved", task_id: id, step });
}
