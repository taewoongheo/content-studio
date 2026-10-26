import { inspectSharedElements } from "../editor/inspection/shared-elements";
import type Database from "better-sqlite3";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import type { ContentJobRecord, ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import type { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { EditorService } from "@/domains/slideshow/editor/service";
import type { EditorCommand } from "@/domains/slideshow/editor/types";
import {
  createContentProject,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import {
  editWithLocalImages,
  type LocalImageCommand,
} from "@/domains/slideshow/server/local-images";

export type ProjectWriteValidator = (project: ContentJobRecord) => void;

export class SlideshowProjectWrites {
  private readonly stores;
  constructor(
    private readonly registry: ContentJobRegistry,
    private readonly database: Database.Database,
    private readonly validate?: ProjectWriteValidator,
  ) {
    this.stores = { projects: new ContentProjectStore(database) };
  }
  create(input: {
    name: string;
    topic: string;
    message: string;
    content_type: string;
    slideCount?: number;
  }) {
    return this.commit(
      () =>
        createContentProject(
          this.registry,
          { name: input.name, slideCount: input.slideCount },
          this.stores,
        ),
      (changed) => {
        this.stores.projects.updateMetadata(changed.id, {
          topic: input.topic,
          message: input.message,
          content_type: input.content_type,
        });
      },
    );
  }
  clone(input: {
    projectId: string;
    name?: string;
    topic?: string;
    message?: string;
    content_type?: string;
  }) {
    if ([input.topic,input.message,input.content_type].some(value => value !== undefined) && [input.topic,input.message,input.content_type].some(value => value === undefined))
      throw new Error("소재·메시지·포맷을 함께 입력해 주세요.");
    return this.commit(
      () => {
        const created = createContentProject(
          this.registry,
          { sourceProjectId: input.projectId, name: input.name },
          this.stores,
        );
        return this.registry.update(created.id, (job) => {
          job.warnings = inspectSharedElements(job.editor.document);
        });
      },
      (changed) => {
        this.stores.projects.copyMetadata(input.projectId, changed.id);
        if (input.topic !== undefined && input.message !== undefined && input.content_type !== undefined)
          this.stores.projects.updateMetadata(changed.id, {
            topic: input.topic,
            message: input.message,
            content_type: input.content_type,
          });
      },
    );
  }
  edit(
    projectId: string,
    commands: Array<EditorCommand | LocalImageCommand>,
    expectedRevision: number,
    expectedTabId?: string,
  ) {
    if (expectedTabId) this.registry.requireTab(projectId, expectedTabId);
    return editWithLocalImages(
      this.registry,
      this.database,
      projectId,
      commands,
      expectedRevision,
      (apply) => this.commit(apply),
    );
  }
  undo(projectId: string, expectedRevision: number, expectedTabId?: string) {
    if (expectedTabId) this.registry.requireTab(projectId, expectedTabId);
    return this.commit(() =>
      new EditorService(this.registry).undo(projectId, expectedRevision),
    );
  }
  private commit(
    apply: () => ContentJobSnapshot,
    afterSave?: (changed: ContentJobSnapshot) => void,
  ) {
    return this.registry.transaction(() =>
      this.database.transaction(() => {
        const changed = apply();
        this.validate?.(this.registry.getRecord(changed.id));
        saveContentProject(
          this.registry,
          changed.id,
          changed.name ?? "새 프로젝트",
          this.stores,
        );
        afterSave?.(changed);
        return this.registry.get(changed.id);
      })(),
    );
  }
}
