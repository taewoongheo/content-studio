import type Database from "better-sqlite3";
import { hasCompleteReuseGuide, type ReuseGuide } from "@/lib/content-jobs/projects/reuse-guide";
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
  clone(input: { templateProjectId: string; name?: string }) {
    let reuseGuide: ReuseGuide | null = null;
    return this.commit(() => {
      const template = this.stores.projects.getSummary(input.templateProjectId);
      if (!template?.isTemplate || !hasCompleteReuseGuide(template.reuseGuide))
        throw new Error("재사용 가이드의 네 항목이 완성된 등록된 템플릿 프로젝트를 선택해 주세요.");
      reuseGuide = template.reuseGuide;
      return createContentProject(this.registry, { sourceProjectId: template.id, name: input.name }, this.stores);
    }, changed => this.stores.projects.updateReuse(changed.id, { reuseGuide }));
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
  private commit(apply: () => ContentJobSnapshot, afterSave?: (changed: ContentJobSnapshot) => void) {
    return this.registry.transaction(() => this.database.transaction(() => {
      const changed = apply();
      saveContentProject(this.registry, changed.id, changed.name ?? "새 프로젝트", this.stores);
      afterSave?.(changed);
      return this.registry.get(changed.id);
    })());
  }
}
