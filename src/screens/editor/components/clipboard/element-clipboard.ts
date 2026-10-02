import type { EditorCommand, EditorDocument, ElementDefinition, PlacedElement } from "@/lib/content-jobs/editor/types";

export type ElementClipboard = {
  element: ElementDefinition;
  source: PlacedElement;
  scope: "all" | "current" | string[];
  placements: Array<{ slideId: string; placement: PlacedElement }>;
};

export function copyElement(document: EditorDocument, slideId: string, placementId: string, selectedSlideIds: string[]): ElementClipboard | null {
  const source = document.slides.find((slide) => slide.id === slideId)?.placements.find((placement) => placement.id === placementId);
  const element = document.elements.find((item) => item.id === source?.elementId);
  if (!source || !element || element.kind === "background") return null;
  const selected = new Set(selectedSlideIds);
  const scope = document.slides.every((slide) => selected.has(slide.id)) ? "all"
    : selected.size === 1 ? "current" : [...selected];
  return structuredClone({ element, source, scope, placements: document.slides.flatMap((slide) => slide.placements
    .filter((placement) => placement.elementId === element.id)
    .map((placement) => ({ slideId: slide.id, placement }))) });
}

export function pasteElement(document: EditorDocument, clipboard: ElementClipboard, destinationSlideId: string, id: () => string) {
  if (!document.slides.some((slide) => slide.id === destinationSlideId)) return null;
  const selected = new Set(clipboard.scope === "all" ? document.slides.map((slide) => slide.id)
    : clipboard.scope === "current" ? [destinationSlideId] : [...clipboard.scope, destinationSlideId]);
  const elementId = id();
  const commands: EditorCommand[] = [{ type: "add_element", element: {
    ...structuredClone(clipboard.element), id: elementId, name: `${clipboard.element.name} 복사본`,
  } }];
  let destinationPlacementId = "";
  for (const slide of document.slides.filter((slide) => selected.has(slide.id))) {
    const originals = clipboard.placements.filter((item) => item.slideId === slide.id).map((item) => item.placement);
    for (const original of originals.length ? originals : [clipboard.source]) {
      const frame = original.frameOverride ?? clipboard.element.frame;
      const placementId = id();
      if (slide.id === destinationSlideId && !destinationPlacementId) destinationPlacementId = placementId;
      commands.push({ type: "place_element", slideId: slide.id, elementId, placementId },
        { type: "set_slot_value", slideId: slide.id, placementId, value: original.value },
        { type: "update_visual", scope: "local", slideId: slide.id, placementId,
          frame: { ...frame, x: frame.x + 0.03, y: frame.y + 0.03 },
          style: { ...clipboard.element.style, ...original.styleOverride } });
    }
  }
  return { commands, destinationPlacementId };
}

export function clipboardShortcut(event: { key: string; code?: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean }, editingText: boolean) {
  if (editingText || event.repeat || event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey)) return null;
  const key = event.code ? event.code.replace(/^Key/, "").toLowerCase() : event.key.toLowerCase();
  return key === "c" ? "copy" : key === "v" ? "paste" : null;
}

export function createClipboardQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return (operation: () => Promise<void>) => {
    const next = pending.then(operation);
    pending = next.catch(() => undefined);
    return next;
  };
}
