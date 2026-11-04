import { isExternalProduction } from "../../../../../domain/start/input";
import { sourceDocument } from "../../../../projects/format/snapshot";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import type { ProductionStore } from "../../../../persistence/store";
import { badgeRepairCommands } from "./repair";

/** Badge integrity is restored before visual AI runs; ambiguous image readings cannot undo it. */
export async function prepareOriginalBadges(store: ProductionStore, taskId: string) {
  const detail = store.assertActive(taskId, "visual");
  if (detail.input && isExternalProduction(detail.input)) return;
  const projectId = detail.task.project_id;
  if (!projectId) return;
  const source = sourceDocument(store, detail);
  if (!source) return;
  await loadContentProject(contentJobRegistry, projectId);
  const project = contentJobRegistry.getRecord(projectId);
  const commands = badgeRepairCommands(project.editor.document, source);
  if (!commands.length) return;
  const writes = new SlideshowProjectWrites(contentJobRegistry, store.db, () => { store.assertActive(taskId, "visual"); });
  await writes.edit(projectId, commands, project.editor.revision, project.tabId);
}
