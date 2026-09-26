import type { ElementFrame, ElementStyle } from "../../types";

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
