import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/background";
import type { EditorCommand, EditorDocument, EditorSlide } from "@/lib/content-jobs/editor/types";

/** Stored artwork order is back-to-front; the layer list is front-to-back. */
export function frontToBack(slide: EditorSlide) {
  return slide.placements.filter((item) => item.elementId !== BACKGROUND_ELEMENT_ID).toReversed();
}

export function reorderLayerCommands(document: EditorDocument, sourceSlideId: string,
  activeId: string, overId: string, selectedSlideIds: string[]): EditorCommand[] {
  const source = document.slides.find((slide) => slide.id === sourceSlideId);
  if (!source || activeId === overId) return [];
  const sourceOrder = frontToBack(source);
  const active = sourceOrder.find((item) => item.id === activeId);
  const overIndex = sourceOrder.findIndex((item) => item.id === overId);
  if (!active || overIndex < 0) return [];
  const over = sourceOrder[overIndex];
  const selected = new Set(selectedSlideIds);
  return document.slides.flatMap((slide): EditorCommand[] => {
    if (!selected.has(slide.id)) return [];
    const order = frontToBack(slide);
    const from = order.findIndex((item) => slide.id === sourceSlideId
      ? item.id === activeId : item.elementId === active.elementId);
    if (from < 0) return [];
    const anchor = order.findIndex((item) => slide.id === sourceSlideId
      ? item.id === overId : item.elementId === over.elementId);
    const to = anchor < 0 ? Math.min(overIndex, order.length - 1) : anchor;
    if (from === to) return [];
    order.splice(to, 0, order.splice(from, 1)[0]);
    const backgroundIds = slide.placements.filter((item) => item.elementId === BACKGROUND_ELEMENT_ID).map((item) => item.id);
    return [{ type: "reorder_layers", slideId: slide.id, placementIds: [...order.toReversed().map((item) => item.id), ...backgroundIds] }];
  });
}
