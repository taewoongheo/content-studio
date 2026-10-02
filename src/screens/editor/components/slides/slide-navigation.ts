import type { EditorDocument, EditorSlide } from "@/lib/content-jobs/editor/types";

export const roleLabels = { hook: "훅", body: "본문", cta: "CTA" } as const;

export function slideLabel(slide: EditorSlide, index: number) {
  return `${index + 1}장 · ${slide.name || roleLabels[slide.role]}`;
}

export function reorderedSlideIds(document: EditorDocument, activeId: string, overId: string): string[] | null {
  const from = document.slides.findIndex((slide) => slide.id === activeId);
  const to = document.slides.findIndex((slide) => slide.id === overId);
  if (from < 0 || to < 0 || from === to) return null;
  const ids = document.slides.map((slide) => slide.id);
  ids.splice(to, 0, ids.splice(from, 1)[0]);
  return ids;
}
