import {
  createContentProject,
  defaultProjectStores,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { ProductionStore } from "./persistence/store";
import { publishChange } from "./events";
export function createTaskProject(
  store: ProductionStore,
  taskId: string,
  slideCount = 6,
) {
  const detail = store.assertActive(taskId, "production");
  if (detail.log.project_id)
    return { projectId: String(detail.log.project_id) };
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
      });
      store.db
        .prepare(
          "UPDATE content_creation_logs SET project_id=?,updated_at=? WHERE id=?",
        )
        .run(job.id, new Date().toISOString(), detail.task.log_id);
      contentJobRegistry.afterCommit(() =>
        publishChange({ task_id: taskId, step: "production", kind: "saved" }),
      );
      return { projectId: job.id };
    })(),
  );
}
