import Ajv from "ajv";
import { MAX_TEXT_COLOR_RANGES } from "./typography/text-colors";
import { EDITOR_FONT_FAMILIES } from "./typography/fonts";
import type { EditorCommand } from "./types";
import { MAX_FRAME_COORDINATE, MAX_FRAME_DIMENSION } from "./types";

const text = { type: "string" };
const color = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const textColors = { type: "array", maxItems: MAX_TEXT_COLOR_RANGES, items: object({
  start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 1 }, color,
}) };
const frame = object({
  x: { type: "number", minimum: -MAX_FRAME_COORDINATE, maximum: MAX_FRAME_COORDINATE },
  y: { type: "number", minimum: -MAX_FRAME_COORDINATE, maximum: MAX_FRAME_COORDINATE },
  width: { type: "number", exclusiveMinimum: 0, maximum: MAX_FRAME_DIMENSION },
  height: { type: "number", exclusiveMinimum: 0, maximum: MAX_FRAME_DIMENSION },
});
const style = object({
  color,
  backgroundColor: { type: "string", pattern: "^(#[0-9a-fA-F]{6}|transparent)$" },
  fontSize: { type: "number", minimum: 8, maximum: 200 },
  lineHeight: { type: "number", minimum: 0.8, maximum: 3 },
  fontWeight: { type: "integer", minimum: 100, maximum: 900 },
  textAlign: { type: "string", enum: ["left", "center", "right"] },
  borderRadius: { type: "number", minimum: 0, maximum: 100 },
  borderEnabled: { type: "boolean" },
  borderColor: color,
  borderWidth: { type: "number", minimum: 0, maximum: 100 },
  fontFamily: { type: "string", enum: EDITOR_FONT_FAMILIES },
  imageFit: { type: "string", enum: ["cover", "contain"] },
}, ["color", "backgroundColor", "fontSize", "lineHeight", "fontWeight", "textAlign", "borderRadius", "fontFamily", "imageFit"]);
const stylePatch = {
  type: "object",
  properties: style.properties,
  additionalProperties: false,
  minProperties: 1,
};
export const editorElementSchema = object({
  id: text,
  name: text,
  role: text,
  kind: { type: "string", enum: ["text", "image", "rectangle", "circle", "triangle"] },
  frame,
  style,
});

function object<Properties extends Record<string, unknown>>(properties: Properties, required = Object.keys(properties)) {
  return { type: "object", properties, required, additionalProperties: false };
}

const commandVariants = [
  object({ type: { const: "set_aspect_ratio" }, aspectRatio: { type: "string", enum: ["4:5", "1:1", "9:16"] } }),
  object({ type: { const: "rename_slide" }, slideId: text, name: { type: "string", minLength: 1, maxLength: 120 } }),
  object({ type: { const: "reorder_slides" }, slideIds: { type: "array", items: text } }),
  object({ type: { const: "reorder_layers" }, slideId: text, placementIds: { type: "array", items: text } }),
  object({ type: { const: "set_slide_background" }, slideId: text, color }),
  object({ type: { const: "set_slot_value" }, slideId: text, placementId: text, value: text, textColors }, ["type", "slideId", "placementId", "value"]),
  object({ type: { const: "set_text_colors" }, slideId: text, placementId: text, textColors }),
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
  commands: { type: "array", items: { oneOf: commandVariants }, maxItems: 200 },
});

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(editorCommandsSchema);
export function validateEditorCommands(value: unknown):
  | { ok: true; value: { commands: EditorCommand[] } }
  | { ok: false; errors: string[] } {
  if (validate(value)) return { ok: true, value: value as { commands: EditorCommand[] } };
  return { ok: false, errors: (validate.errors ?? []).map((error) =>
    `${error.instancePath || "/"}: ${error.message ?? "유효하지 않은 값입니다."}`) };
}
