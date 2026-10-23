import type Database from "better-sqlite3";
import type { Row } from "../../../domain/contracts";

const PERFORMANCE_COUNT = 12;
const RECENT_COUNT = 12;

/** Rank first, then fill a separate recent group without counting overlaps. */
export function readPlanningLogs(db: Database.Database, query: string): Row[] {
  return db.prepare(`
    WITH eligible AS (
      SELECT l.*, p.name,
        CASE WHEN l.view_count > 0 AND l.like_count IS NOT NULL
          AND l.comment_count IS NOT NULL AND l.save_count IS NOT NULL
          THEN 1.0 * (l.like_count + l.comment_count + l.save_count) / l.view_count
        END AS engagement_rate
      FROM content_creation_logs l
      JOIN content_projects p ON p.id = l.project_id
      WHERE l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL
        AND (COALESCE(l.topic, '') LIKE ? OR p.name LIKE ?)
    ), best AS (
      SELECT id FROM eligible WHERE engagement_rate IS NOT NULL
      ORDER BY engagement_rate DESC, actual_published_at DESC, id DESC
      LIMIT ${PERFORMANCE_COUNT}
    ), recent AS (
      SELECT id FROM eligible WHERE id NOT IN (SELECT id FROM best)
      ORDER BY actual_published_at DESC, id DESC
      LIMIT ${RECENT_COUNT}
    )
    SELECT eligible.*,
      CASE WHEN id IN (SELECT id FROM best) THEN 'performance' ELSE 'recent' END AS selection_group
    FROM eligible
    WHERE id IN (SELECT id FROM best) OR id IN (SELECT id FROM recent)
    ORDER BY CASE WHEN id IN (SELECT id FROM best) THEN 0 ELSE 1 END,
      CASE WHEN id IN (SELECT id FROM best) THEN engagement_rate END DESC,
      actual_published_at DESC, id DESC
  `).all(`%${query}%`, `%${query}%`) as Row[];
}
