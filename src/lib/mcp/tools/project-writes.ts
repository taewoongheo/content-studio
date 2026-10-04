import type Database from "better-sqlite3";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { EditorService } from "@/lib/content-jobs/editor/service";
import type { EditorCommand } from "@/lib/content-jobs/editor/types";
import { createContentProject, saveContentProject } from "@/lib/content-jobs/projects/service";
import { editWithLocalImages, type LocalImageCommand } from "./images";

export class McpProjectWrites {
  private readonly stores;
  constructor(private readonly registry: ContentJobRegistry, private readonly database: Database.Database) {
    this.stores = { projects: new ContentProjectStore(database) };
  }
  create(input: Parameters<typeof createContentProject>[1]) {
    return this.commit(() => createContentProject(this.registry, input, this.stores));
  }
  edit(projectId: string, commands: Array<EditorCommand | LocalImageCommand>, expectedRevision: number, expectedTabId?: string) {
    if (expectedTabId) this.registry.requireTab(projectId, expectedTabId);
    return editWithLocalImages(this.registry, this.database, projectId, commands, expectedRevision,
      (apply) => this.commit(apply));
  }
  undo(projectId: string, expectedRevision: number, expectedTabId?: string) {
    if (expectedTabId) this.registry.requireTab(projectId, expectedTabId);
    return this.commit(() => new EditorService(this.registry).undo(projectId, expectedRevision));
  }
  private commit(apply: () => ContentJobSnapshot) {
    return this.registry.transaction(() => this.database.transaction(() => {
      const changed = apply();
      saveContentProject(this.registry, changed.id, changed.name ?? "새 프로젝트", this.stores);
      return this.registry.get(changed.id);
    })());
  }
}
