import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { defaultPlacement, defaultVisualSlides, selectVisualSlides } from "./components/element-scope";

export const roleLabels = { hook: "훅", body: "본문", cta: "CTA" } as const;

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
    ? [{ slideId: item.id, label: `${index + 1}장 · ${roleLabels[item.role]}` }] : []) ?? [] : [];
  const visualTargets = element ? document?.slides.flatMap((item) => item.placements
    .filter((placed) => placed.elementId === element.id)
    .map((placed) => ({ slideId: item.id, placement: placed }))) ?? [] : [];
  const scopeKey = slide && placement ? `${slide.id}:${placement.id}` : "";
  const selectedSlideIds = slide && placement
    ? selectVisualSlides(slide.id, appliedSlides.map((item) => item.slideId),
      scopeSelection?.key === scopeKey ? scopeSelection.slideIds
        : defaultVisualSlides(appliedSlides.map((item) => item.slideId)),
      { slideId: slide.id, checked: true })
    : [];
  return { slide, placement, element, appliedSlides, visualTargets, scopeKey, selectedSlideIds };
}
