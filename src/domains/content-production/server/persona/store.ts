import type Database from "better-sqlite3";
import { personaSettingsSchema, type Persona, type PersonaSettings } from "../../domain/persona/model";

export function readPersona(db: Database.Database): Persona | null {
  const row = db.prepare("SELECT document_json, revision FROM content_persona WHERE id=1").get() as { document_json: string; revision: number } | undefined;
  if (!row) return null;
  const { sources, ...document } = JSON.parse(row.document_json);
  delete document.preserve_structure;
  delete document.include_links;
  delete document.content.topics;
  return { ...document, analyzed_posts: document.analyzed_posts ?? sources?.length ?? 0, revision: row.revision };
}

export function replacePersona(db: Database.Database, persona: Omit<Persona, "revision">) {
  personaSettingsSchema.parse({ name: persona.name, output_language: persona.output_language,
    content: persona.content });
  db.prepare(`INSERT INTO content_persona(id,document_json,revision) VALUES(1,?,1)
    ON CONFLICT(id) DO UPDATE SET document_json=excluded.document_json,revision=content_persona.revision+1`).run(JSON.stringify(persona));
  return readPersona(db)!;
}

export function editPersona(db: Database.Database, revision: number, settings: PersonaSettings) {
  const current = readPersona(db);
  if (!current) throw new Error("먼저 계정을 분석해 페르소나를 만들어 주세요.");
  const next = { ...current, ...personaSettingsSchema.parse(settings), updated_at: new Date().toISOString() };
  const result = db.prepare("UPDATE content_persona SET document_json=?,revision=revision+1 WHERE id=1 AND revision=?")
    .run(JSON.stringify(next), revision);
  if (!result.changes) throw new Error("페르소나가 다른 화면에서 변경되었습니다. 새로고침 후 다시 수정해 주세요.");
  return readPersona(db)!;
}
