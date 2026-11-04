import type { EditorDocument } from "@/domains/slideshow/editor/types";

/** Include every use of a changed shared definition, not just explicitly selected pages. */
export function affectedSlides(before: EditorDocument, after: EditorDocument): string[] {
  const signature = (document: EditorDocument, id: string) => {
    const index = document.slides.findIndex(slide => slide.id === id);
    const slide = document.slides[index];
    if (!slide) return "";
    return JSON.stringify({ index, aspectRatio: document.aspectRatio, slide,
      elements: slide.placements.map(placement => document.elements.find(element => element.id === placement.elementId)) });
  };
  // A deleted final page has no surviving ID to mark; review the new last page.
  const removed = before.slides.some(slide => !after.slides.some(next => next.id === slide.id));
  const lastId = removed ? after.slides.at(-1)?.id : undefined;
  return after.slides.filter(slide => slide.id === lastId || signature(before, slide.id) !== signature(after, slide.id)).map(slide => slide.id);
}
