import type { ContentJobRecord } from "../../../domain/types";
import { BACKGROUND_ELEMENT_ID } from "../../background";
import type { EditorCommand, EditorDocument, ElementFrame, ElementStyle } from "../../types";

export type ChatTarget = {
  slideId: string;
  placementId: string;
  elementId: string;
  slideIds: string[];
};

type TargetedStyle = { [Key in keyof ElementStyle]: ElementStyle[Key] | null };

export type TargetedChatOutput = {
  intent: "edit" | "answer" | "unsupported";
  reply: string;
  style: TargetedStyle;
  frame: ElementFrame | null;
  slotValues: Array<{ slideId: string; placementId: string; value: string }>;
};

const text = { type: "string" };
const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const nullable = (schema: unknown) => ({ oneOf: [schema, { type: "null" }] });
const object = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

export const targetedChatSchema = object({
  intent: { type: "string", enum: ["edit", "answer", "unsupported"] },
  reply: text,
  style: object({
    color: nullable(color),
    backgroundColor: nullable({ type: "string", pattern: "^(#[0-9a-fA-F]{6}|transparent)$" }),
    fontSize: nullable({ type: "number", minimum: 8, maximum: 200 }),
    fontWeight: nullable({ type: "integer", minimum: 100, maximum: 900 }),
    textAlign: nullable({ type: "string", enum: ["left", "center", "right"] }),
    borderRadius: nullable({ type: "number", minimum: 0, maximum: 100 }),
    fontFamily: nullable({ type: "string", enum: ["sans-serif", "serif", "monospace"] }),
    imageFit: nullable({ type: "string", enum: ["cover", "contain"] }),
  }),
  frame: nullable(object({
    x: { type: "number", minimum: 0, maximum: 1 },
    y: { type: "number", minimum: 0, maximum: 1 },
    width: { type: "number", exclusiveMinimum: 0, maximum: 1 },
    height: { type: "number", exclusiveMinimum: 0, maximum: 1 },
  })),
  slotValues: { type: "array", items: object({ slideId: text, placementId: text, value: text }), maxItems: 40 },
});

export function resolveChatTarget(document: EditorDocument, value: unknown): ChatTarget {
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

function selectedPlacements(document: EditorDocument, target: ChatTarget) {
  const selected = new Set(target.slideIds);
  return document.slides.flatMap((slide) => selected.has(slide.id)
    ? slide.placements.filter((placement) => placement.elementId === target.elementId)
      .map((placement) => ({ slideId: slide.id, placementId: placement.id })) : []);
}

export function targetedChatPrompt(job: ContentJobRecord, target: ChatTarget) {
  const document = job.editor.document!;
  const element = document.elements.find((item) => item.id === target.elementId)!;
  const placements = selectedPlacements(document, target);
  return `사용자와 편집 중인 슬라이드쇼를 논의하세요. 최종 응답은 지정된 JSON Schema만 따르세요.
이번 요청의 수정 대상은 사용자가 선택한 Element 하나입니다. 다른 Element를 수정하거나 새로 만들지 마세요. 다른 대상을 수정하라는 요청에는 수정값을 모두 비우고 선택을 해제하도록 안내하세요.
선택 대상: ${JSON.stringify({ ...target, name: element.name, kind: element.kind, role: element.role })}
수정 가능한 슬롯: ${JSON.stringify(placements)}
style에서 변경하지 않는 속성은 null로 두세요. frame은 위치나 크기를 바꾸라는 요청일 때만 전체 좌표를 출력하고, 아니면 null로 두세요.
style과 frame의 적용 범위는 앱이 선택된 장 목록으로 결정합니다. slotValues에는 실제 내용을 바꿀 슬롯만 넣으세요. 질문이나 논의만 할 때는 수정값을 모두 비우세요.
intent는 실제 수정이면 edit, 질문이면 answer, 선택 대상을 벗어난 요청이면 unsupported로 지정하세요. edit에는 적어도 한 가지 수정값이 필요하고, answer/unsupported에는 수정값을 넣지 마세요.
배경 Element가 선택되었을 때만 슬라이드 전체 배경을 바꾸세요. 다른 Element가 선택된 경우 '배경색'은 그 Element 상자의 backgroundColor입니다. 배경 Element는 배경색만 변경할 수 있습니다. 이미지 슬롯에는 업로드된 이미지 ID만 사용할 수 있습니다.
변경 전후를 짧게 설명하고, 변경되는 장의 다른 Element와의 배치 충돌 및 텍스트 위계를 확인하세요.
제품 정보: ${JSON.stringify(job.productContext)}
선택한 주제: ${JSON.stringify(job.editor.selectedTopic)}
현재 편집 문서: ${JSON.stringify(document)}
사용할 수 있는 업로드 이미지: ${JSON.stringify(job.assets.map(({ id, name }) => ({ id, name })))}
최근 대화: ${JSON.stringify(job.editor.messages.slice(-12))}
가장 마지막 사용자 메시지에 응답하세요.`;
}

export function targetedMutationCommands(document: EditorDocument, target: ChatTarget,
  output: TargetedChatOutput): EditorCommand[] {
  const element = document.elements.find((item) => item.id === target.elementId);
  if (!element) throw new Error("선택한 Element를 찾을 수 없습니다.");
  const style = Object.fromEntries(Object.entries(output.style).filter(([, value]) => value !== null)) as Partial<ElementStyle>;
  if (element.id === BACKGROUND_ELEMENT_ID && (output.frame ||
    Object.keys(style).some((key) => key !== "backgroundColor") || output.slotValues.length > 0))
    throw new Error("배경 Element는 배경색만 변경할 수 있습니다.");

  const placements = selectedPlacements(document, target);
  const allowedSlots = new Set(placements.map(({ slideId, placementId }) => `${slideId}:${placementId}`));
  const slotKeys = output.slotValues.map(({ slideId, placementId }) => `${slideId}:${placementId}`);
  if (new Set(slotKeys).size !== slotKeys.length || slotKeys.some((key) => !allowedSlots.has(key)) ||
    (output.slotValues.length > 0 && !["text", "image"].includes(element.kind)))
    throw new Error("선택 범위 밖의 슬롯은 변경할 수 없습니다.");

  const commands: EditorCommand[] = [];
  if (output.frame || Object.keys(style).length > 0) {
    const allAppliedSlides = document.slides.filter((slide) => slide.placements.some((placement) =>
      placement.elementId === target.elementId)).map((slide) => slide.id);
    if (target.slideIds.length === allAppliedSlides.length) {
      commands.push({ type: "update_visual", scope: "common", elementId: target.elementId,
        ...(output.frame ? { frame: output.frame } : {}), ...(Object.keys(style).length ? { style } : {}) });
    } else {
      commands.push(...placements.map(({ slideId, placementId }) => ({ type: "update_visual" as const,
        scope: "local" as const, slideId, placementId,
        ...(output.frame ? { frame: output.frame } : {}), ...(Object.keys(style).length ? { style } : {}) })));
    }
  }
  commands.push(...output.slotValues.map((item) => ({ type: "set_slot_value" as const, ...item })));
  if ((output.intent === "edit") !== (commands.length > 0))
    throw new Error("AI 응답의 수정 여부와 실제 수정 명령이 일치하지 않습니다.");
  return commands;
}
