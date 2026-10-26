import type Database from "better-sqlite3";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import type { PublishedPost } from "../../domain/published-posts";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
});

export function listPublishedPosts(db: Database.Database): PublishedPost[] {
  const projects = new Map(new ContentProjectStore(db).list().map(project => [project.id, project]));
  const logs = db.prepare(`SELECT project_id, post_url, actual_published_at FROM content_creation_logs
    WHERE project_id IS NOT NULL AND post_url IS NOT NULL AND actual_published_at IS NOT NULL
    ORDER BY actual_published_at DESC, id DESC`).all() as Array<{
      project_id: string; post_url: string; actual_published_at: string;
    }>;
  return logs.flatMap(log => {
    const project = projects.get(log.project_id);
    return project ? [{ ...project, title: project.name, publishedAt: log.actual_published_at,
      publishedOn: dateFormatter.format(new Date(log.actual_published_at)), postUrl: log.post_url }] : [];
  });
}


export function listFormalContent(db: Database.Database) {
  const drafts = new Set((db.prepare("SELECT project_id FROM content_drafts WHERE project_id IS NOT NULL")
    .all() as {project_id: string}[]).map(row => row.project_id));
  return new ContentProjectStore(db).list().filter(project => !drafts.has(project.id));
}
