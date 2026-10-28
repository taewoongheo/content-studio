import type Database from "better-sqlite3";
import type { Row } from "../../../domain/contracts";

import { sampleReferences } from "../../../domain/references/sampling";
import { readSampling } from "../../settings/sampling";

export function readPlanningLogs(db: Database.Database, query: string, candidates = readSampling(db).internalCandidates): Row[] {
  const rows = db.prepare(`SELECT l.*, p.name,
    CASE WHEN l.view_count > 0 AND l.like_count IS NOT NULL AND l.comment_count IS NOT NULL AND l.save_count IS NOT NULL
    THEN 1.0*(l.like_count+l.comment_count+l.save_count)/l.view_count END AS engagement_rate
    FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id
    WHERE l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL
    AND (COALESCE(l.topic,'') LIKE ? OR p.name LIKE ? OR COALESCE(l.message,'') LIKE ? OR COALESCE(l.content_type,'') LIKE ?)
  `).all(...Array(4).fill(`%${query}%`)) as Row[];
  return sampleReferences(rows,candidates,"actual_published_at");
}
