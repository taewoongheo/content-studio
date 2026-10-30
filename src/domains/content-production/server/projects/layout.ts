import { PRODUCTION_ASPECT_RATIO } from "../../domain/contracts";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { ensureSharedBackground, validateEditorDocument } from "@/domains/slideshow/editor/document";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { OperationError } from "@/lib/errors/operation";
import type { ProductionStore } from "../persistence/store";
import { saveTaskProject } from "./creation";

/** Normalize the saved source while preserving its copy, geometry and asset references. */
function layoutDocument(savedDocument: EditorDocument): EditorDocument {
  // Match saved-project opening: normalize retired fonts and legacy style defaults first.
  const document = ensureSharedBackground(structuredClone(savedDocument));
  const errors = validateEditorDocument(document);
  if (errors.length) {
    throw new OperationError("LAYOUT_SOURCE_INVALID", "원본 게시글의 슬라이드 구조가 올바르지 않습니다.", { errors });
  }
  document.aspectRatio = PRODUCTION_ASPECT_RATIO;
  return document;
}

/** All modes clone the internal source confirmed by analysis. */
export function cloneTaskProject(store: ProductionStore, taskId: string, sourceProjectId: string, reason: string) {
  const detail = store.assertActive(taskId, "production");
  if (detail.task.project_id) return { projectId: detail.task.project_id, reused: true };
  const input = detail.input;
  const selected = (detail.analysis.sources as Array<{clone_project_id?:string}> | undefined)?.find(source => source.clone_project_id)?.clone_project_id
    ?? (input?.request.mode === "past_post" ? input.request.sourceProjectId : undefined);
  if (selected !== sourceProjectId)
    throw new OperationError("LAYOUT_SOURCE_NOT_SELECTED", "분석에서 확정한 내부 원본만 복제할 수 있습니다.");
  if (!reason.trim()) throw new Error("배치를 선택한 이유가 필요합니다.");
  const saved = new ContentProjectStore(store.db).get(sourceProjectId);
  if (!saved) throw new OperationError("LAYOUT_SOURCE_MISSING", "원본 게시글을 찾을 수 없습니다.");
  const source = { kind: "log", id: sourceProjectId,
    part: "Selected source format, page structure, typography and spacing", used_for: reason.trim() };
  return { ...saveTaskProject(store, taskId, layoutDocument(saved.document as EditorDocument), source, saved.assets), sourceProjectId };
}
