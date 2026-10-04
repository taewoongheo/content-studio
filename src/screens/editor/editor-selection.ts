import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { defaultPlacement, selectVisualSlides } from "./components/element-scope";
import { slideLabel } from "./components/slides/slide-navigation";

export { roleLabels } from "./components/slides/slide-navigation";

export function resolveEditorSelection(
  document: EditorDocument | null,
  requestedSlideId: string,
  requestedPlacementId: string | null,
  scopeSelection: { key: string; slideIds: string[] } | null,
) {
  const slide = document?.slides.find((item) => item.id === requestedSlideId) ?? document?.slides[0];
  const placement = slide?.placements.find((item) => item.id === requestedPlacementId) ?? (slide ? defaultPlacement(slide) : null);
  const element = document?.elements.find((item) => item.id === placement?.elementId) ?? null;
  const appliedSlides = element ? document?.slides.flatMap((item, index) => item.placements.some((placed) => placed.elementId === element.id)
    ? [{ slideId: item.id, label: slideLabel(item, index) }] : []) ?? [] : [];
  const visualTargets = element ? document?.slides.flatMap((item) => item.placements
    .filter((placed) => placed.elementId === element.id)
    .map((placed) => ({ slideId: item.id, placement: placed }))) ?? [] : [];
  const scopeKey = slide && placement ? `${slide.id}:${placement.id}` : "";
  const scopeSlides = document?.slides.map((item, index) => ({ slideId: item.id,
    label: slideLabel(item, index), hasElement: item.placements.some((placed) => placed.elementId === element?.id) })) ?? [];
  const selectedSlideIds = slide && placement
    ? selectVisualSlides(slide.id, scopeSlides.map((item) => item.slideId),
      scopeSelection?.key === scopeKey ? scopeSelection.slideIds
        : [slide.id],
      { slideId: slide.id, checked: true })
    : [];
  return { slide, placement, element, appliedSlides, scopeSlides, visualTargets, scopeKey, selectedSlideIds };
}
