import { PRODUCTION_ASPECT_RATIO, type Row } from "../../domain/contracts";
import { readContentMetadata } from "@/domains/content-metadata/schema";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import {
  createContentProject,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { OperationError } from "@/lib/errors/operation";
import type { ProductionStore } from "../persistence/store";
import { publishChange } from "../events";

/** Link document creation, saved project and production provenance in one transaction. */
export function saveTaskProject(
  store: ProductionStore,
  taskId: string,
  document: EditorDocument,
  source?: Row,
) {
  const detail = store.assertActive(taskId, "production");

  if (detail.task.project_id)
    return { projectId: detail.task.project_id, reused: true };

  const projects = new ContentProjectStore(store.db),
    metadata = readContentMetadata(detail.log);

  return contentJobRegistry.transaction(() =>
    store.db.transaction(() => {
      const job = createContentProject(
        contentJobRegistry,
        {
          name: metadata.topic,
          structure: document.structure,
          aspectRatio: document.aspectRatio,
          slideCount: document.slides.length,
          outputLanguage: "English",
        },
        { projects },
      );

      contentJobRegistry.update(job.id, (record) => {
        record.editor.document = document;
      });

      saveContentProject(contentJobRegistry, job.id, metadata.topic, {
        projects,
      });
      projects.updateMetadata(job.id, metadata);
      const now = new Date().toISOString();
      store.db
        .prepare(
          "UPDATE content_drafts SET project_id=?,updated_at=? WHERE id=?",
        )
        .run(job.id, now, taskId);
      if (source) {
        store.db
          .prepare(
            "UPDATE content_production_drafts SET sources_json=?,updated_at=? WHERE draft_id=?",
          )
          .run(
            JSON.stringify([
              ...((detail.production?.sources as unknown[]) ?? []),
              source,
            ]),
            now,
            taskId,
          );
        store.db
          .prepare(
            "UPDATE content_creation_logs SET sources_json=?,updated_at=? WHERE id=?",
          )
          .run(
            JSON.stringify([...(detail.log.sources as unknown[]), source]),
            now,
            detail.task.log_id,
          );
      }
      contentJobRegistry.afterCommit(() =>
        publishChange({ task_id: taskId, step: "production", kind: "saved" }),
      );
      return { projectId: job.id, reused: false };
    })(),
  );
}

export function createTaskProject(
  store: ProductionStore,
  taskId: string,
  slideCount: number,
) {
  const detail = store.assertActive(taskId, "production");
  if (detail.task.project_id)
    return { projectId: detail.task.project_id, reused: true };
  if (detail.input?.request.mode === "past_post")
    throw new OperationError(
      "SOURCE_LAYOUT_REQUIRED",
      "과거 게시글 기반 제작은 지정 원본의 배치를 복제해 주세요.",
    );
  if (!Number.isInteger(slideCount) || slideCount < 1 || slideCount > 20)
    throw new Error("장 수는 1~20으로 입력해 주세요.");
  return saveTaskProject(
    store,
    taskId,
    createBlankDocument({
      structure: "sequential",
      aspectRatio: PRODUCTION_ASPECT_RATIO,
      slideCount,
    }),
  );
}
