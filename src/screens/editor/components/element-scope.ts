import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";
import type { EditorCommand, EditorSlide, PlacedElement } from "@/lib/content-jobs/editor/types";

export function defaultPlacement(slide: EditorSlide): PlacedElement | null {
  return slide.placements.find((placement) => placement.elementId !== BACKGROUND_ELEMENT_ID) ??
    slide.placements.find((placement) => placement.elementId === BACKGROUND_ELEMENT_ID) ?? null;
}

export type ScopeChoice = "current" | "all" | { slideId: string; checked: boolean };

export function defaultVisualSlides(availableSlideIds: string[]) {
  return [...availableSlideIds];
}

export function selectVisualSlides(
  currentSlideId: string,
  availableSlideIds: string[],
  selectedSlideIds: string[],
  choice: ScopeChoice,
): string[] {
  const available = new Set(availableSlideIds);
  if (!available.has(currentSlideId)) return [];
  if (choice === "current") return [currentSlideId];
  if (choice === "all") return [...new Set(availableSlideIds)];

  const selected = new Set(selectedSlideIds.filter((id) => available.has(id)));
  selected.add(currentSlideId);
  if (choice.slideId !== currentSlideId && available.has(choice.slideId)) {
    if (choice.checked) selected.add(choice.slideId);
    else selected.delete(choice.slideId);
  }
  return availableSlideIds.filter((id) => selected.has(id));
}

export function visualScopeLabel(selectedCount: number, availableCount: number) {
  if (availableCount <= 1) return "이 장에만 존재";
  if (selectedCount === availableCount) return `전체 적용 · ${availableCount}/${availableCount}장`;
  if (selectedCount <= 1) return `현재 장만 적용 · 1/${availableCount}장`;
  return `일부 적용 · ${selectedCount}/${availableCount}장`;
}

export function removalCommandsForScope(
  targets: Array<{ slideId: string; placement: PlacedElement }>,
  selectedSlideIds: string[],
): EditorCommand[] {
  const selected = new Set(selectedSlideIds);
  return targets.filter((target) => selected.has(target.slideId)).map((target) => ({
    type: "remove_placement", slideId: target.slideId, placementId: target.placement.id,
  }));
}
