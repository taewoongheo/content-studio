import type { EditorCommand, ElementDefinition, ElementFrame, ElementStyle, PlacedElement } from "@/lib/content-jobs/editor/types";

export type VisualTarget = { slideId: string; placement: PlacedElement };
export type ElementDraft = {
  name: string;
  role: string;
  value: string;
  frame: ElementFrame;
  style: ElementStyle;
};

const MIN_FRAME_SIZE = 0.04;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function draftWithFontSize(draft: ElementDraft, fontSize: number): ElementDraft {
  return {
    ...draft,
    style: { ...draft.style, fontSize },
  };
}

export function frameWithLockedDimension(
  frame: ElementFrame,
  dimension: "width" | "height",
  value: number,
): ElementFrame {
  const currentSize = frame[dimension];
  if (currentSize <= 0 || value <= 0) return { ...frame, [dimension]: value };
  const minimumScale = Math.max(MIN_FRAME_SIZE / frame.width, MIN_FRAME_SIZE / frame.height);
  const maximumScale = Math.min((1 - frame.x) / frame.width, (1 - frame.y) / frame.height);
  const scale = clamp(value / currentSize, minimumScale, maximumScale);
  return { ...frame, width: round(frame.width * scale), height: round(frame.height * scale) };
}

export function makeElementDraft(element: ElementDefinition, placement: PlacedElement, visualPlacement = placement): ElementDraft {
  return {
    name: element.name,
    role: element.role,
    value: placement.value,
    frame: visualPlacement.frameOverride ?? element.frame,
    style: { ...element.style, ...visualPlacement.styleOverride },
  };
}

export function validElementDraft(draft: ElementDraft) {
  const { x, y, width, height } = draft.frame;
  return Boolean(draft.name.trim() && draft.role.trim()) &&
    [x, y, width, height].every(Number.isFinite) && x >= 0 && y >= 0 && width > 0 && height > 0 &&
    x + width <= 1 && y + height <= 1 && draft.style.fontSize >= 8 && draft.style.fontSize <= 200 &&
    Number.isInteger(draft.style.fontWeight) && draft.style.fontWeight >= 100 && draft.style.fontWeight <= 900 &&
    draft.style.borderRadius >= 0 && draft.style.borderRadius <= 100;
}

export function commandsFromDraft(
  draft: ElementDraft,
  element: ElementDefinition,
  placement: PlacedElement,
  slideId: string,
  targets: VisualTarget[],
  selectedSlideIds: string[],
  visualPlacement = placement,
): EditorCommand[] {
  const commands: EditorCommand[] = [];
  if (draft.name !== element.name || draft.role !== element.role)
    commands.push({ type: "update_element", elementId: element.id, name: draft.name, role: draft.role });
  if (element.kind === "text" && draft.value !== placement.value)
    commands.push({ type: "set_slot_value", slideId, placementId: placement.id, value: draft.value });

  const baseFrame = visualPlacement.frameOverride ?? element.frame;
  const baseStyle = { ...element.style, ...visualPlacement.styleOverride };
  const changedFrameKeys = (Object.keys(baseFrame) as Array<keyof ElementFrame>)
    .filter((key) => draft.frame[key] !== baseFrame[key]);
  const changedStyle = Object.fromEntries((Object.keys(baseStyle) as Array<keyof ElementStyle>)
    .filter((key) => draft.style[key] !== baseStyle[key])
    .map((key) => [key, draft.style[key]])) as Partial<ElementStyle>;
  if (changedFrameKeys.length || Object.keys(changedStyle).length) {
    const selected = targets.filter((target) => selectedSlideIds.includes(target.slideId));
    if (selectedSlideIds.length > 0 && new Set(selected.map((target) => target.slideId)).size === new Set(targets.map((target) => target.slideId)).size) {
      const frame = changedFrameKeys.length ? { ...element.frame } : undefined;
      for (const key of changedFrameKeys) if (frame) frame[key] = draft.frame[key];
      commands.push({ type: "update_visual", scope: "common", elementId: element.id,
        ...(frame ? { frame } : {}), ...(Object.keys(changedStyle).length ? { style: changedStyle } : {}) });
    } else {
      for (const target of selected) {
        const frame = changedFrameKeys.length ? { ...(target.placement.frameOverride ?? element.frame) } : undefined;
        for (const key of changedFrameKeys) if (frame) frame[key] = draft.frame[key];
        commands.push({ type: "update_visual", scope: "local", slideId: target.slideId,
          placementId: target.placement.id, ...(frame ? { frame } : {}),
          ...(Object.keys(changedStyle).length ? { style: changedStyle } : {}) });
      }
    }
  }
  return commands;
}
