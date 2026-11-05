import { visibleGap, type SlideLayout } from "@/domains/slideshow/rendering/inspection/metrics";
import type { ContentJobRecord } from "@/domains/slideshow/domain/types";
import { OperationError } from "@/lib/errors/operation";
import type { LayoutCheck } from "../../../domain/planning/layout";
export type LayoutObservation = { revision:number; slides:Map<string,SlideLayout> };

export function assertLayoutReview(project:ContentJobRecord, checks:LayoutCheck[], observed?:LayoutObservation) {
  const doc=project.editor.document;
  if (!observed || observed.revision!==project.editor.revision || doc.slides.some(s=>!observed.slides.has(s.id)))
    throw new OperationError("LAYOUT_REVIEW_STALE","최신 저장본의 전체 장을 inspect_slide_layout으로 측정해 주세요.");
  for (const slide of doc.slides) {
    const text=observed.slides.get(slide.id)!.elements.filter(e=>e.kind==="text"&&e.visible);
    if (slide.role==="body" && text.length>1 && !checks.some(c=>c.slide_id===slide.id))
      throw new OperationError("LAYOUT_CHECKS_MISSING","본문의 관련 요소 간 간격 기준을 남겨 주세요.",{slide_id:slide.id});
  }
  const issues=[];
  for (const check of checks) {
    const slide=observed.slides.get(check.slide_id);
    const from=slide?.elements.find(e=>e.placementId===check.from_id)?.visible;
    const to=slide?.elements.find(e=>e.placementId===check.to_id)?.visible;
    if (!from || !to || check.from_id===check.to_id || check.min_gap>check.max_gap)
      throw new OperationError("LAYOUT_CHECK_INVALID","존재하는 서로 다른 요소와 올바른 간격 범위를 지정해 주세요.",{check});
    const actual=visibleGap(from,to,check.axis);
    if (actual<check.min_gap || actual>check.max_gap) issues.push({...check,actual_gap:actual});
  }
  if (issues.length) throw new OperationError("LAYOUT_GAP_MISMATCH","측정 간격이 지정한 범위를 벗어납니다. 배치를 보정하고 다시 측정해 주세요.",{issues});
}
