import type { ContentJobRecord } from "@/domains/slideshow/domain/types";
import { OperationError } from "@/lib/errors/operation";
import { PRODUCTION_ASPECT_RATIO } from "../../../domain/contracts";
import type { ToolAttempt } from "../../../domain/diagnostics";
import { assertUniqueProjectImages } from "../../images/unique";
import { requiredToolFailure } from "../diagnostics/failure";
import type { z } from "zod";
import type { slidePlanSchema } from "../../../domain/planning/contracts";

/** The plan must describe the linked draft, not stale pages from an earlier attempt. */
export function assertCurrentSlidePlan(project: ContentJobRecord, plan: z.infer<typeof slidePlanSchema>) {
  const slides = project.editor.document.slides;
  if (slides.length !== plan.length || slides.some((slide, index) =>
    plan[index].slide_id !== slide.id || plan[index].role !== slide.role))
    throw new OperationError("SLIDE_PLAN_MISMATCH", "장별 제작 계획을 현재 슬라이드의 순서·역할에 맞춰 주세요.");
}

export interface ObservedReview {
  revision: number;
  slides: Set<string>;
}
interface ReportedReview {
  reviewed_revision: number;
  reviewed_slide_ids: string[];
}

/** Structural persistence checks apply without requiring visual inspection. */
export function assertSavedProjectContent(project: ContentJobRecord) {
  const { document, revision } = project.editor;
  if (document.aspectRatio !== PRODUCTION_ASPECT_RATIO)
    throw new OperationError("PRODUCTION_ASPECT_RATIO_FIXED", "자동 제작 완료 전 화면 비율을 4:5로 맞춰 주세요.");
  assertUniqueProjectImages(project);
  const kinds = new Map(document.elements.map(element => [element.id, element.kind]));
  const hasEmptySlide = document.slides.some(slide => !slide.placements.some(placement => {
    const kind = kinds.get(placement.elementId);
    if (!kind || kind === "background") return false;
    return kind === "text" || kind === "image" ? !!placement.value.trim() : true;
  }));
  if (hasEmptySlide) throw new OperationError("EMPTY_SLIDE", "내용이 비어 있는 슬라이드가 있습니다.");
  if (project.savedRevision !== revision)
    throw new OperationError("PROJECT_NOT_SAVED", "최신 편집 내용을 저장해 주세요.");
}

/** Only final visual verification requires observed full-slide preview coverage. */
export function assertCompleteProjectReview(
  project: ContentJobRecord,
  output: ReportedReview,
  observed: ObservedReview | undefined,
  toolCalls: ToolAttempt[],
) {
  assertSavedProjectContent(project);
  const { document, revision } = project.editor;
  if (!observed)
    throw requiredToolFailure(toolCalls, ["preview_slide", "preview_slides"], "현재 슬라이드의 실제 이미지 검토가 필요합니다.");
  if (project.savedRevision !== revision || revision !== output.reviewed_revision || observed.revision !== output.reviewed_revision)
    throw new OperationError("REVIEW_REVISION_MISMATCH", "최신 저장본의 이미지 검토가 필요합니다.", {
      saved_revision: project.savedRevision, current_revision: revision,
      reported_revision: output.reviewed_revision, observed_revision: observed.revision,
    });
  if (!document.slides.every(slide => observed.slides.has(slide.id) && output.reviewed_slide_ids.includes(slide.id)))
    throw new OperationError("REVIEW_SLIDES_INCOMPLETE", "모든 슬라이드를 이미지로 검토해 주세요.");
}
