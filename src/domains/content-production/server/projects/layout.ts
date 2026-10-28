import { PRODUCTION_ASPECT_RATIO } from "../../domain/contracts";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { ensureSharedBackground, validateEditorDocument } from "@/domains/slideshow/editor/document";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { OperationError } from "@/lib/errors/operation";
import type { ProductionStore } from "../persistence/store";
import { saveTaskProject } from "./creation";

/** Preserve saved geometry and styling while removing source copy and image references. */
function layoutDocument(savedDocument: EditorDocument): EditorDocument {
  // Match saved-project opening: normalize retired fonts and legacy style defaults first.
  const document = ensureSharedBackground(structuredClone(savedDocument));
  const errors = validateEditorDocument(document);
  if (errors.length) {
    throw new OperationError("LAYOUT_SOURCE_INVALID", "원본 게시글의 슬라이드 구조가 올바르지 않습니다.", { errors });
  }
  document.aspectRatio = PRODUCTION_ASPECT_RATIO;
  const kinds = new Map(document.elements.map(element => [element.id, element.kind]));
  for (const slide of document.slides) {
    delete slide.name;
    for (const placement of slide.placements) {
      const kind = kinds.get(placement.elementId);
      const isBadge = kind === "text" && placement.value.trim() === "LIFTCODE";
      if (kind !== "image" && (kind !== "text" || isBadge)) continue;
      placement.value = "";
      delete placement.textColors;
      delete placement.textWeights;
    }
  }
  return document;
}

/** A past-post request always uses the explicitly selected saved source. */
export function cloneTaskProject(store: ProductionStore, taskId: string, sourceProjectId: string, reason: string) {
  const detail = store.assertActive(taskId, "production");
  if (detail.task.project_id) return { projectId: detail.task.project_id, reused: true };
  const input = detail.input;
  if (input?.request.mode !== "past_post" || input.request.sourceProjectId !== sourceProjectId)
    throw new OperationError("LAYOUT_SOURCE_NOT_SELECTED", "과거 게시글 기반 제작에서 선택한 원본만 복제할 수 있습니다.");
  if (!reason.trim()) throw new Error("배치를 선택한 이유가 필요합니다.");
  const saved = new ContentProjectStore(store.db).getContent(sourceProjectId);
  if (!saved) throw new OperationError("LAYOUT_SOURCE_MISSING", "원본 게시글을 찾을 수 없습니다.");
  const source = { kind: "log", id: input.source!.id,
    part: "Selected source format, page structure, typography and spacing", used_for: reason.trim() };
  return { ...saveTaskProject(store, taskId, layoutDocument(saved.document as EditorDocument), source), sourceProjectId };
}
