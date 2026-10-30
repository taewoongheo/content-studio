import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import type { ProductionStore } from "../../../../persistence/store";
import { badgeRepairCommands } from "./repair";

/** Badge integrity is restored before visual AI runs; ambiguous image readings cannot undo it. */
export async function prepareOriginalBadges(store: ProductionStore, taskId: string) {
  const detail = store.assertActive(taskId, "visual");
  const projectId = detail.task.project_id;
  const sourceId = (detail.analysis.sources as Array<{clone_project_id?:string}> | undefined)?.find(source => source.clone_project_id)?.clone_project_id
    ?? detail.input?.source?.project_id;
  if (!projectId || !sourceId) return;
  const source = new ContentProjectStore(store.db).get(sourceId);
  if (!source) throw new Error("뱃지 복구용 원본을 찾을 수 없습니다.");
  await loadContentProject(contentJobRegistry, projectId);
  const project = contentJobRegistry.getRecord(projectId);
  const commands = badgeRepairCommands(project.editor.document, source.document as EditorDocument);
  if (!commands.length) return;
  const writes = new SlideshowProjectWrites(contentJobRegistry, store.db, () => { store.assertActive(taskId, "visual"); });
  await writes.edit(projectId, commands, project.editor.revision, project.tabId);
}
