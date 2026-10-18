import { editorCommandsSchema } from "./schema";

const localImageSchema = {
  type: "object", additionalProperties: false,
  properties: { type: { const: "set_local_image" }, slideId: { type: "string", minLength: 1 },
    placementId: { type: "string", minLength: 1 }, localPath: { type: "string", minLength: 1 } },
  required: ["type", "slideId", "placementId", "localPath"],
};
const commandSchema = editorCommandsSchema.properties.commands;
export const localEditorCommandsSchema = { ...commandSchema, minItems: 1, items: { oneOf: [...commandSchema.items.oneOf, localImageSchema] } };

