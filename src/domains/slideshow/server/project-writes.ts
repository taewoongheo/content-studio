import { ContentTemplateStore } from "./persistence/templates/store";
import { inspectSharedElements } from "../editor/inspection/shared-elements";
import type Database from "better-sqlite3";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import type { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { EditorService } from "@/domains/slideshow/editor/service";
import type { EditorCommand } from "@/domains/slideshow/editor/types";
import { createContentProject, saveContentProject } from "@/domains/slideshow/projects/service";
import { editWithLocalImages, type LocalImageCommand } from "@/domains/slideshow/server/local-images";

export class SlideshowProjectWrites {
  private readonly stores;
  constructor(private readonly registry: ContentJobRegistry, private readonly database: Database.Database) {
    this.stores = { projects: new ContentProjectStore(database) };
  }
  clone(input: { templateId: string; name?: string; topic?: string; message?: string }) {
    if ((input.topic === undefined) !== (input.message === undefined))
      throw new Error("주제와 메시지를 함께 입력해 주세요.");
    return this.commit(() => {
      const template = new ContentTemplateStore(this.database).get(input.templateId);
      if (!template || template.templateOrder === null || !template.composition.trim())
        throw new Error("구성이 작성된 등록된 템플릿 프로젝트를 선택해 주세요.");
      const created = createContentProject(this.registry, { sourceProjectId: template.id, name: input.name }, this.stores);
      return this.registry.update(created.id, job => { job.warnings = inspectSharedElements(job.editor.document); });
    }, changed => {
      this.stores.projects.setCloneSource(changed.id, input.templateId);
      if (input.topic !== undefined && input.message !== undefined)
        this.stores.projects.updateMetadata(changed.id, { topic: input.topic, message: input.message });
    });
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
