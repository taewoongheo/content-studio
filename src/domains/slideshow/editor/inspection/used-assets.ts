import type { EditorDocument } from "../types";

/** Only image placement values reference stored assets; text values are never asset IDs. */
export function usedImageAssetIds(document: EditorDocument): Set<string> {
  const images = new Set(document.elements.filter(element => element.kind === "image").map(element => element.id));
  return new Set(document.slides.flatMap(slide => slide.placements
    .filter(placement => images.has(placement.elementId) && placement.value)
    .map(placement => placement.value)));
}
