import type Database from "better-sqlite3";
import type { Row } from "../../domain/contracts";
export function topicHistory(db: Database.Database): Row[] {
  const rows = db.prepare(`SELECT l.id,l.project_id,p.name,l.topic,l.message,l.content_type,l.actual_published_at,
  l.observed_at,l.view_count,l.like_count,l.comment_count,l.save_count,l.share_count
  FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id
  WHERE l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL ORDER BY l.id`).all() as Row[];
  const performance = db.prepare(`SELECT p.* FROM content_performance p JOIN content_creation_logs l ON l.id=p.log_id
  WHERE l.post_url IS NOT NULL ORDER BY p.log_id,p.stage`).all() as Row[];
  const grouped = new Map<string, Row[]>();
  for (const row of performance) {
    const list = grouped.get(String(row.log_id)) ?? [];
    list.push(row);
    grouped.set(String(row.log_id), list);
  }
  return rows.map(row => ({ ...row, performance: grouped.get(String(row.id)) ?? [] }));
}
export function topicReferences(db: Database.Database): Row[] {
  return db.prepare(`SELECT r.id,r.account,r.caption,r.title,r.topic,r.message,r.content_type
  FROM content_external_references r JOIN content_reference_accounts a ON a.username=r.account
  WHERE a.enabled=1 AND r.excluded=0 ORDER BY r.account,r.id`).all() as Row[];
}
export function semanticHistory(rows: Row[]) {
  return rows.map(({ id, name, topic, message, content_type }) => ({ id, name, topic, message, content_type }));
}
