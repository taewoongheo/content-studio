import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { ProductionStore } from "../persistence/store";
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
export { cloneTaskProject } from "./layout";

export { createTaskProject } from "./creation";
