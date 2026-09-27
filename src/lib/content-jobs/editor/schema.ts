import { validateStructuredOutput } from "../structured-output/schemas";
import type { SlideshowStructure } from "../domain/types";
import type { EditorAnalysis, EditorCommand } from "./types";

const text = { type: "string" };
const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const frame = object({
  x: { type: "number", minimum: 0, maximum: 1 },
  y: { type: "number", minimum: 0, maximum: 1 },
  width: { type: "number", exclusiveMinimum: 0, maximum: 1 },
  height: { type: "number", exclusiveMinimum: 0, maximum: 1 },
});
const style = object({
  color,
  backgroundColor: { type: "string", pattern: "^(#[0-9a-fA-F]{6}|transparent)$" },
  fontSize: { type: "number", minimum: 8, maximum: 200 },
  fontWeight: { type: "integer", minimum: 100, maximum: 900 },
  textAlign: { type: "string", enum: ["left", "center", "right"] },
  borderRadius: { type: "number", minimum: 0, maximum: 100 },
  fontFamily: { type: "string", enum: ["sans-serif", "serif", "monospace"] },
  imageFit: { type: "string", enum: ["cover", "contain"] },
});
const stylePatch = {
  type: "object",
  properties: style.properties,
  additionalProperties: false,
  minProperties: 1,
};
export const formatNotesSchema = object({
  visualRules: text,
  writingStyle: text,
  hookPattern: text,
  bodyProgression: text,
});
export const editorElementSchema = object({
  id: text,
  name: text,
  role: text,
  kind: { type: "string", enum: ["text", "image", "rectangle", "circle", "triangle"] },
  frame,
  style,
  sourceImageId: text,
});

function object(properties: Record<string, unknown>, required = Object.keys(properties)) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const editorAnalysisSchema = object({
  formatNotes: formatNotesSchema,
  elements: { type: "array", items: editorElementSchema, maxItems: 80 },
  slides: { type: "array", items: object({
    imageId: text,
    role: { type: "string", enum: ["hook", "body", "cta"] },
    backgroundColor: color,
    elementIds: { type: "array", items: text },
  }), minItems: 1, maxItems: 20 },
});

const commandVariants = [
  object({ type: { const: "set_slide_background" }, slideId: text, color }),
  object({ type: { const: "set_slot_value" }, slideId: text, placementId: text, value: text }),
  object({ type: { const: "update_visual" }, scope: { const: "common" }, elementId: text, frame, style: stylePatch }, ["type", "scope", "elementId"]),
  object({ type: { const: "update_visual" }, scope: { const: "local" }, slideId: text, placementId: text, frame, style: stylePatch }, ["type", "scope", "slideId", "placementId"]),
  object({ type: { const: "update_element" }, elementId: text, name: text, role: text }, ["type", "elementId"]),
  object({ type: { const: "add_element" }, element: editorElementSchema }),
  object({ type: { const: "place_element" }, slideId: text, elementId: text, placementId: text }),
  object({ type: { const: "add_slide" }, afterSlideId: text, sourceSlideId: text,
    newSlideId: text, copyContent: { type: "boolean" } }),
  object({ type: { const: "remove_slide" }, slideId: text }),
  object({ type: { const: "remove_placement" }, slideId: text, placementId: text }),
  object({ type: { const: "duplicate_placement" }, sourceSlideId: text,
    sourcePlacementId: text, newElementId: text, placements: { type: "array", items: object({ slideId: text,
      sourcePlacementId: text, newPlacementId: text }), minItems: 1, maxItems: 20 } }),
];

export const editorCommandsSchema = object({
  commands: { type: "array", items: { oneOf: commandVariants }, maxItems: 40 },
});

export function validateEditorAnalysis(
  value: unknown,
  imageIds: string[],
  structure: SlideshowStructure,
  slideCount: number,
) {
  const result = validateStructuredOutput<EditorAnalysis>(editorAnalysisSchema, value);
  if (!result.ok) return result;
  const errors: string[] = [];
  const output = result.value;
  if (Object.values(output.formatNotes).some((value) => !value.trim()))
    errors.push("포맷 규칙을 모두 작성해야 합니다.");
  const expected = structure === "repeating" ? 3 : slideCount;
  if (output.slides.length !== expected ||
    output.slides.some((slide, index) => slide.imageId !== imageIds[index]))
    errors.push("슬라이드와 입력 이미지의 순서가 일치하지 않습니다.");
  if (structure === "repeating" && output.slides.some((slide, index) =>
    slide.role !== (["hook", "body", "cta"] as const)[index]))
    errors.push("반복형은 훅·본문·CTA 역할 순서여야 합니다.");
  const elementIds = output.elements.map((element) => element.id);
  if (new Set(elementIds).size !== elementIds.length)
    errors.push("Element ID가 중복됩니다.");
  const knownElements = new Set(elementIds);
  const knownImages = new Set(imageIds);
  for (const element of output.elements) {
    if (!knownImages.has(element.sourceImageId) || !element.role.trim() ||
      !element.name.trim() ||
      element.frame.x + element.frame.width > 1 ||
      element.frame.y + element.frame.height > 1)
      errors.push(`Element ${element.id}의 근거 또는 정의가 올바르지 않습니다.`);
  }
  if (output.slides.some((slide) => slide.elementIds.some((id) => !knownElements.has(id))))
    errors.push("슬라이드가 존재하지 않는 Element를 참조합니다.");
  const kinds = new Map(output.elements.map((element) => [element.id, element.kind]));
  if (output.slides.some((slide) => !slide.elementIds.some((id) => kinds.get(id) === "text")))
    errors.push("각 레퍼런스 장면에는 텍스트 Element가 하나 이상 필요합니다.");
  return errors.length > 0 ? { ok: false as const, errors } : result;
}

export function validateEditorCommands(value: unknown) {
  return validateStructuredOutput<{ commands: EditorCommand[] }>(editorCommandsSchema, value);
}
