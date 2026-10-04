import { isDeepStrictEqual } from "node:util";
import { getLocalDatabase } from "@/lib/local-db/database";
import type { ContentJobRecord } from "../../domain/types";
import { ContentJobError, type ContentJobRegistry } from "../../workflow/registry";
import { defaultProjectStores } from "../service";
import { notifyProjectsChanged } from "../events";

type Stores = ReturnType<typeof defaultProjectStores>;

export function hasUnsavedChanges(job: ContentJobRecord, stores: Stores) {
  const saved = stores.projects.getContent(job.id);
  const baseline = saved ?? job.initialState;
  if (!baseline) return true; // Keep older in-memory drafts safe after a development hot reload.
  return !isDeepStrictEqual(job.editor.document, baseline.document)
    || job.outputLanguage !== baseline.outputLanguage || job.name !== baseline.name;
}

/** Rename metadata only; do not persist an unsaved document just because its tab was renamed. */
export function renameProject(registry: ContentJobRegistry, id: string, requestedName: string, expectedTabId?: string,
  database = getLocalDatabase(), stores = defaultProjectStores()) {
  const name = requestedName.trim();
  if (!name || name.length > 120) throw new ContentJobError("INVALID_OUTPUT", "프로젝트 이름을 120자 이하로 입력해 주세요.");
  return registry.transaction(() => database.transaction(() => {
    if (expectedTabId) registry.requireTab(id, expectedTabId);
    if (!registry.has(id) && !stores.projects.getSummary(id)) throw new ContentJobError("JOB_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    stores.projects.rename(id, name);
    if (registry.has(id)) registry.update(id, job => {
      if (job.name !== name) job.editor.revision++;
      job.name = name;
      if (stores.projects.getContent(id) && !hasUnsavedChanges(job, stores)) job.savedRevision = job.editor.revision;
    });
    registry.afterCommit(notifyProjectsChanged);
  })());
}

export function deleteProject(registry: ContentJobRegistry, id: string, expectedTabId?: string,
  database = getLocalDatabase(), stores = defaultProjectStores()) {
  return registry.transaction(() => database.transaction(() => {
    if (expectedTabId) registry.requireTab(id, expectedTabId);
    if (!registry.has(id) && !stores.projects.getSummary(id)) throw new ContentJobError("JOB_NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    stores.projects.delete(id);
    if (registry.has(id)) registry.remove(id);
    registry.afterCommit(notifyProjectsChanged);
  })());
}
