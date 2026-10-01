import { editorElementSchema } from "../schema";

const text = { type: "string" };
const stringArray = { type: "array", items: text };
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const array = (items: unknown, count?: number) => ({
  type: "array",
  items,
  ...(count === undefined ? {} : { minItems: count, maxItems: count }),
});
const frame = object({
  x: { type: "number" },
  y: { type: "number" },
  width: { type: "number", exclusiveMinimum: 0 },
  height: { type: "number", exclusiveMinimum: 0 },
});
const style = object({
  color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
  backgroundColor: { type: "string", pattern: "^(#[0-9a-fA-F]{6}|transparent)$" },
  fontSize: { type: "number", minimum: 8, maximum: 200 },
  lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
  fontWeight: { type: "integer", minimum: 100, maximum: 900 },
  textAlign: { type: "string", enum: ["left", "center", "right"] },
  borderRadius: { type: "number", minimum: 0, maximum: 100 },
  fontFamily: { type: "string", enum: ["sans-serif", "serif", "monospace"] },
  imageFit: { type: "string", enum: ["cover", "contain"] },
});
const slotValue = object({ slideId: text, placementId: text, value: text });

export const topicSuggestionsSchema = object({
  message: text,
  topics: array(object({
    id: text,
    title: text,
    angle: text,
    rationale: text,
    sourceUrls: stringArray,
  }), 3),
});

export const bodyFillSchema = object({
  message: text,
  slotValues: array(slotValue),
});

export const hookSuggestionsSchema = object({
  message: text,
  hooks: array(object({ id: text, text, rationale: text }), 4),
});

export const topicRevisionSchema = object({
  message: text,
  topic: object({ title: text, angle: text, rationale: text, sourceUrls: stringArray }),
});

export const hookRevisionSchema = object({
  message: text,
  hook: object({ text, rationale: text }),
});

export const chatAnswerSchema = object({ reply: text });

export const chatEditSchema = object({
  reply: text,
  backgroundColorAll: { oneOf: [{ type: "string", pattern: "^#[0-9a-fA-F]{6}$" }, { type: "null" }] },
  backgroundUpdates: array(object({ slideId: text, color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } })),
  newElements: array(editorElementSchema),
  newPlacements: array(object({ slideId: text, elementId: text, placementId: text })),
  removedPlacements: array(object({ slideId: text, placementId: text })),
  slotValues: array(slotValue),
  commonVisualUpdates: array(object({ elementId: text, frame, style })),
  localVisualUpdates: array(object({ slideId: text, placementId: text, frame, style })),
  elementUpdates: array(object({ elementId: text, name: text, role: text })),
});
