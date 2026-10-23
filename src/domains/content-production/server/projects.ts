import {
  createContentProject,
  defaultProjectStores,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { ProductionStore } from "./persistence/store";
import { publishChange } from "./events";
import { deleteProject } from "@/domains/slideshow/projects/lifecycle/management";

export function deleteTaskProject(store: ProductionStore, taskId: string) {
  const detail = store.get(taskId);
  if (detail.task.state !== "finished" || !detail.task.project_id)
    throw new Error("완성된 포스트만 삭제할 수 있습니다.");
  contentJobRegistry.transaction(() => store.db.transaction(() => {
    deleteProject(contentJobRegistry, detail.task.project_id!, undefined, store.db);
    store.remove(taskId);
  })());
}
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
