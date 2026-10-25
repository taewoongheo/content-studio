import type Database from "better-sqlite3";
import type { ContentMetadata } from "@/domains/content-metadata/schema";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";

/** One saved description for editor projects and their published creation logs. */
export function updateContentMetadata(db: Database.Database, projectId: string, input: ContentMetadata) {
  return db.transaction(() => {
    const project = new ContentProjectStore(db).updateMetadata(projectId, input);
    db.prepare("UPDATE content_creation_logs SET topic=?,message=?,content_type=?,updated_at=? WHERE project_id=?")
      .run(project.topic,project.message,project.content_type,project.updatedAt,projectId);
    return project;
  })();
}
