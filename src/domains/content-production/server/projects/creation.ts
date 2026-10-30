import { type Row } from "../../domain/contracts";
import { readContentMetadata } from "@/domains/content-metadata/schema";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import {
  createContentProject,
  saveContentProject,
} from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import type { ProductionStore } from "../persistence/store";
import { publishChange } from "../events";

/** Link document creation, saved project and production provenance in one transaction. */
export function saveTaskProject(
  store: ProductionStore,
  taskId: string,
  document: EditorDocument,
  source?: Row,
  assets: import("@/domains/slideshow/server/persistence/projects/store").SavedProjectAsset[] = [],
) {
  const detail = store.assertActive(taskId, store.get(taskId).task.current_step);

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
        record.assets = assets.map(asset => ({id:asset.assetId,name:asset.name,type:asset.type,size:asset.bytes.length}));
        record.imageData = Object.fromEntries(assets.map(asset => [asset.assetId,new Uint8Array(asset.bytes)]));
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
