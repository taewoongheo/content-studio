import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";
import type { EditorSlide, ElementKind, PlacedElement } from "@/lib/content-jobs/editor/types";

export function defaultPlacement(slide: EditorSlide): PlacedElement | null {
  return slide.placements.find((placement) => placement.elementId !== BACKGROUND_ELEMENT_ID) ??
    slide.placements.find((placement) => placement.elementId === BACKGROUND_ELEMENT_ID) ?? null;
}

export type ScopeChoice = "current" | "all" | { slideId: string; checked: boolean };

export function defaultVisualSlides(kind: ElementKind, currentSlideId: string, availableSlideIds: string[]) {
  return kind === "background" ? [...availableSlideIds] : [currentSlideId];
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
  if (selectedCount <= 1) return "현재 장";
  if (selectedCount === availableCount) return "전체";
  return `선택한 ${selectedCount}장`;
}
