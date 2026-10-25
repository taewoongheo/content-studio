import type Database from "better-sqlite3";
import type { ContentMetadata } from "@/domains/content-metadata/schema";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import {
  createContentProject,
  defaultProjectStores,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { ProductionStore } from "./persistence/store";
import { publishChange } from "./events";
import { deleteProject } from "@/domains/slideshow/projects/lifecycle/management";

export function discardTask(store: ProductionStore, taskId: string) {
  const projectId = store.get(taskId).task.project_id;
  contentJobRegistry.transaction(() => store.db.transaction(() => {
    if (projectId) deleteProject(contentJobRegistry, projectId, undefined, store.db);
    store.remove(taskId);
  })());
}

export function deleteTaskProject(store: ProductionStore, taskId: string) {
  const detail = store.get(taskId);
  const projectId = detail.task.project_id;
  if (detail.task.state !== "finished" || !projectId)
    throw new Error("완성된 포스트만 삭제할 수 있습니다.");
  discardTask(store, taskId);
}
export function createTaskProject(
  store: ProductionStore,
  taskId: string,
  slideCount = 6,
) {
  const detail = store.assertActive(taskId, "production");
  if (detail.task.project_id)
    return { projectId: String(detail.task.project_id) };
  return contentJobRegistry.transaction(() =>
    store.db.transaction(() => {
      const topic = String(detail.log.topic),
        message = String(detail.log.message);
      const job = createContentProject(contentJobRegistry, {
        name: topic,
        slideCount,
      });
      saveContentProject(contentJobRegistry, job.id, topic);
      defaultProjectStores().projects.updateMetadata(job.id, {
        topic,
        message,
        content_type: String(detail.log.content_type),
      });
      store.db
        .prepare(
          "UPDATE content_drafts SET project_id=?,updated_at=? WHERE id=?",
        )
        .run(job.id, new Date().toISOString(), taskId);
      contentJobRegistry.afterCommit(() =>
        publishChange({ task_id: taskId, step: "production", kind: "saved" }),
      );
      return { projectId: job.id };
    })(),
  );
}

/** One saved description for editor projects and their published creation logs. */
export function updateContentMetadata(db: Database.Database, projectId: string, input: ContentMetadata) {
  return db.transaction(() => {
    const project = new ContentProjectStore(db).updateMetadata(projectId, input);
    db.prepare("UPDATE content_creation_logs SET topic=?,message=?,content_type=?,updated_at=? WHERE project_id=?")
      .run(project.topic,project.message,project.content_type,project.updatedAt,projectId);
    return project;
  })();
}
