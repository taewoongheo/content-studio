import type { EditorCommand, ElementFrame, PlacedElement } from "@/lib/content-jobs/editor/types";

type Target = { slideId: string; placement: PlacedElement };

export function frameCommandsForScope(
  elementId: string,
  frame: ElementFrame,
  targets: Target[],
  selectedSlideIds: string[],
): EditorCommand[] {
  const availableSlides = new Set(targets.map((target) => target.slideId));
  const selectedSlides = new Set(selectedSlideIds.filter((id) => availableSlides.has(id)));
  if (selectedSlides.size === 0) return [];
  if (selectedSlides.size === availableSlides.size)
    return [{ type: "update_visual", scope: "common", elementId, frame }];
  return targets.filter((target) => selectedSlides.has(target.slideId)).map((target) => ({
    type: "update_visual", scope: "local", slideId: target.slideId,
    placementId: target.placement.id, frame,
  }));
}
