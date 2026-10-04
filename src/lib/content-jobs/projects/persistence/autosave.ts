import type { ContentJobSnapshot } from "../../domain/types";
import type { ContentJobRegistry } from "../../workflow/registry";
import { getLocalDatabase } from "@/lib/local-db/database";
import { defaultProjectStores, saveContentProject } from "../service";
import { hasUnsavedChanges } from "../lifecycle/management";

export const PROJECT_AUTOSAVE_MS = 5_000;

/** UI edits wait at most five seconds. MCP writes continue to save synchronously. */
export class ProjectAutosave {
  private pending = new Map<string, { timer: ReturnType<typeof setTimeout>; unsubscribe: () => void }>();
  constructor(private readonly registry: ContentJobRegistry,
    private readonly database = getLocalDatabase,
    private readonly stores = defaultProjectStores) {}

  schedule(job: ContentJobSnapshot) {
    if (job.savedRevision === job.editor.revision || this.pending.has(job.id)) return;
    // Idle delay and maximum wait are both five seconds; later edits cannot extend this deadline.
    const timer = setTimeout(() => {
      this.cancel(job.id);
      if (!this.registry.has(job.id) || this.registry.getRecord(job.id).tabId !== job.tabId) return;
      try {
        const stores = this.stores();
        const current = this.registry.getRecord(job.id);
        if (!hasUnsavedChanges(current, stores)) {
          if (stores.projects.getSummary(job.id)) this.registry.update(job.id, record => {
            record.savedRevision = record.editor.revision;
            delete record.saveError;
          });
          return;
        }
        this.registry.transaction(() => this.database().transaction(() => {
          saveContentProject(this.registry, job.id, current.name ?? "새 프로젝트", stores);
        })());
      } catch (error) {
        this.registry.update(job.id, current => {
          current.saveError = error instanceof Error ? error.message : "자동 저장하지 못했습니다.";
        });
        this.schedule(this.registry.get(job.id));
      }
    }, PROJECT_AUTOSAVE_MS);
    timer.unref();
    const unsubscribe = this.registry.subscribe(job.id, current => {
      if (current.savedRevision === current.editor.revision) this.cancel(job.id);
    }, () => this.cancel(job.id));
    this.pending.set(job.id, { timer, unsubscribe });
  }

  cancel(projectId: string) {
    const pending = this.pending.get(projectId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.unsubscribe();
    this.pending.delete(projectId);
  }
}
