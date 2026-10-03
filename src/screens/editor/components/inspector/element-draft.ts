import type { EditorCommand, ElementDefinition, ElementFrame, ElementStyle, PlacedElement, TextColorRange } from "@/lib/content-jobs/editor/types";
import { validTextColors } from "@/lib/content-jobs/editor/typography/text-colors";
import { validBorder, withBorderDefaults } from "@/lib/content-jobs/editor/elements/style";

export type VisualTarget = { slideId: string; placement: PlacedElement };
export type ElementDraft = {
  name: string;
  role: string;
  value: string;
  textColors: TextColorRange[];
  frame: ElementFrame;
  style: ElementStyle;
};

const MIN_FRAME_SIZE = 0.04;

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
  const scale = Math.max(value / currentSize, minimumScale);
  return { ...frame, width: round(frame.width * scale), height: round(frame.height * scale) };
}

export function makeElementDraft(element: ElementDefinition, placement: PlacedElement, visualPlacement = placement): ElementDraft {
  return {
    name: element.name,
    role: element.role,
    value: placement.value,
    textColors: structuredClone(placement.textColors ?? []),
    frame: visualPlacement.frameOverride ?? element.frame,
    style: withBorderDefaults({ ...element.style, ...visualPlacement.styleOverride }),
  };
}

export function validElementDraft(draft: ElementDraft) {
  const { x, y, width, height } = draft.frame;
  return Boolean(draft.name.trim() && draft.role.trim()) && validTextColors(draft.value, draft.textColors) &&
    [x, y, width, height].every(Number.isFinite) && width > 0 && height > 0 &&
    draft.style.fontSize >= 8 && draft.style.fontSize <= 200 &&
    draft.style.lineHeight >= 0.8 && draft.style.lineHeight <= 3 &&
    Number.isInteger(draft.style.fontWeight) && draft.style.fontWeight >= 100 && draft.style.fontWeight <= 900 &&
    draft.style.borderRadius >= 0 && draft.style.borderRadius <= 100 && validBorder(draft.style);
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
  if (element.kind === "text") {
    const colorsChanged = JSON.stringify(draft.textColors) !== JSON.stringify(placement.textColors ?? []);
    if (draft.value !== placement.value)
      commands.push({ type: "set_slot_value", slideId, placementId: placement.id, value: draft.value,
        ...(draft.textColors.length || placement.textColors !== undefined ? { textColors: draft.textColors } : {}) });
    else if (colorsChanged)
      commands.push({ type: "set_text_colors", slideId, placementId: placement.id, textColors: draft.textColors });
  }

  const baseFrame = visualPlacement.frameOverride ?? element.frame;
  const baseStyle = withBorderDefaults({ ...element.style, ...visualPlacement.styleOverride });
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
