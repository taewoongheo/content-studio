import type Database from "better-sqlite3";
import type { Row } from "../../../domain/contracts";

/** Text-based subject matching before any source images are rendered. No performance ranking. */
export function readVisualReferences(db: Database.Database, keywords: string[]): Row[] {
  const terms = [...new Set(keywords.map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (!terms.length || terms.length > 5) throw new Error("주제 검색어를 1~5개 입력해 주세요.");
  const field = "lower(COALESCE(l.topic,'') || ' ' || COALESCE(l.message,'') || ' ' || p.name)";
  const conditions = terms.map(() => `instr(${field},?)>0`).join(" OR ");
  return db.prepare(`SELECT l.id,l.project_id,p.name,l.topic,l.message,l.content_type,l.post_url,l.actual_published_at
    FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id
    WHERE l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL AND (${conditions})
    ORDER BY l.actual_published_at DESC,l.id DESC LIMIT 5`).all(...terms) as Row[];
}

export function readSelectedVisualReferences(db: Database.Database, projectIds: string[]): Row[] {
  const read = db.prepare(`SELECT l.id,l.project_id,p.name,l.topic,l.message,l.content_type,l.post_url,l.actual_published_at
    FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id
    WHERE l.project_id=? AND l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL`);
  return projectIds.flatMap(projectId => { const row = read.get(projectId); return row ? [row as Row] : []; });
}
