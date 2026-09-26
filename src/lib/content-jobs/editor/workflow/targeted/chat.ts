import { BACKGROUND_ELEMENT_ID } from "../../background";
import type { EditorChatTarget, EditorCommand, EditorDocument, ElementFrame, ElementStyle } from "../../types";
import type { TargetedChatOutput } from "./schema";

export function resolveChatTarget(document: EditorDocument, value: unknown): EditorChatTarget {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("선택한 Element 정보가 올바르지 않습니다.");
  const target = value as Record<string, unknown>;
  if (typeof target.slideId !== "string" || typeof target.placementId !== "string" ||
    typeof target.elementId !== "string" || !Array.isArray(target.slideIds) ||
    target.slideIds.length === 0 || target.slideIds.some((id) => typeof id !== "string") ||
    new Set(target.slideIds).size !== target.slideIds.length ||
    !target.slideIds.includes(target.slideId))
    throw new Error("선택한 Element의 적용 범위가 올바르지 않습니다.");
  const slide = document.slides.find((item) => item.id === target.slideId);
  const placement = slide?.placements.find((item) => item.id === target.placementId);
  if (!placement || placement.elementId !== target.elementId ||
    target.slideIds.some((id) => !document.slides.some((item) => item.id === id &&
      item.placements.some((placed) => placed.elementId === target.elementId))))
    throw new Error("선택한 Element가 해당 슬라이드에 없습니다.");
  return { slideId: target.slideId, placementId: target.placementId,
    elementId: target.elementId, slideIds: target.slideIds as string[] };
}

export function selectedPlacements(document: EditorDocument, target: EditorChatTarget) {
  const selected = new Set(target.slideIds);
  return document.slides.flatMap((slide) => selected.has(slide.id)
    ? slide.placements.filter((placement) => placement.elementId === target.elementId)
      .map((placement) => ({ slideId: slide.id, placementId: placement.id })) : []);
}

function assertSlotUpdatesInScope(document: EditorDocument, target: EditorChatTarget,
  output: TargetedChatOutput, kind: string) {
  const placements = selectedPlacements(document, target);
  const allowedSlots = new Set(placements.map(({ slideId, placementId }) => `${slideId}:${placementId}`));
  const slotKeys = output.slotValues.map(({ slideId, placementId }) => `${slideId}:${placementId}`);
  if (new Set(slotKeys).size !== slotKeys.length || slotKeys.some((key) => !allowedSlots.has(key)) ||
    (output.slotValues.length > 0 && !["text", "image"].includes(kind)))
    throw new Error("선택 범위 밖의 슬롯은 변경할 수 없습니다.");
}

function visualCommands(document: EditorDocument, target: EditorChatTarget,
  frame: ElementFrame | null, style: Partial<ElementStyle>): EditorCommand[] {
  if (!frame && Object.keys(style).length === 0) return [];
  const patch = { ...(frame ? { frame } : {}), ...(Object.keys(style).length ? { style } : {}) };
  const appliedSlideCount = document.slides.filter((slide) => slide.placements.some((placement) =>
    placement.elementId === target.elementId)).length;
  if (target.slideIds.length === appliedSlideCount)
    return [{ type: "update_visual", scope: "common", elementId: target.elementId, ...patch }];
  return selectedPlacements(document, target).map(({ slideId, placementId }) => ({
    type: "update_visual", scope: "local", slideId, placementId, ...patch,
  }));
}

export function targetedMutationCommands(document: EditorDocument, target: EditorChatTarget,
  output: TargetedChatOutput): EditorCommand[] {
  const element = document.elements.find((item) => item.id === target.elementId);
  if (!element) throw new Error("선택한 Element를 찾을 수 없습니다.");
  const style = Object.fromEntries(Object.entries(output.style).filter(([, value]) => value !== null)) as Partial<ElementStyle>;
  if (element.id === BACKGROUND_ELEMENT_ID && (output.frame ||
    Object.keys(style).some((key) => key !== "backgroundColor") || output.slotValues.length > 0))
    throw new Error("배경 Element는 배경색만 변경할 수 있습니다.");
  assertSlotUpdatesInScope(document, target, output, element.kind);
  const commands: EditorCommand[] = [
    ...visualCommands(document, target, output.frame, style),
    ...output.slotValues.map((item) => ({ type: "set_slot_value" as const, ...item })),
  ];
  if ((output.intent === "edit") !== (commands.length > 0))
    throw new Error("AI 응답의 수정 여부와 실제 수정 명령이 일치하지 않습니다.");
  return commands;
}
