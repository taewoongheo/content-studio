import { getLocalDatabase } from "@/lib/local-db/database";
import type { ContentJobRegistry } from "../../workflow/registry";
import { ContentJobError } from "../../workflow/registry";
import { defaultProjectStores, saveContentProject } from "../service";
import { hasUnsavedChanges } from "./management";

export type CloseDecision = "check" | "save" | "discard";
/** Compare against persisted contents, or the original blank draft when it has never been saved. */
export function closeProjectTab(registry: ContentJobRegistry, projectId: string, tabId: string,
  revision: number, database = getLocalDatabase(), stores = defaultProjectStores(), decision: CloseDecision = "check") {
  return registry.transaction(() => database.transaction(() => {
    const job = registry.requireTab(projectId, tabId);
    if (job.editor.revision !== revision) throw new ContentJobError("INVALID_STAGE", "탭의 내용이 변경되었습니다. 최신 상태를 확인하고 다시 닫아 주세요.");
    if (decision === "check" && hasUnsavedChanges(job, stores)) return { requiresConfirmation: true as const };
    if (decision === "save") saveContentProject(registry, projectId, job.name ?? "새 프로젝트", stores);
    registry.remove(projectId);
    return { requiresConfirmation: false as const };
  })());
}
