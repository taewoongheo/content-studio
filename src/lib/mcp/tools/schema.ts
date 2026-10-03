import * as z from "zod/v4";
import { editorCommandsSchema } from "@/lib/content-jobs/editor/schema";

const localImageSchema = {
  type: "object", additionalProperties: false,
  properties: { type: { const: "set_local_image" }, slideId: { type: "string", minLength: 1 },
    placementId: { type: "string", minLength: 1 }, localPath: { type: "string", minLength: 1 } },
  required: ["type", "slideId", "placementId", "localPath"],
};
const commandSchema = editorCommandsSchema.properties.commands;
export const editSchema = z.fromJSONSchema({
  type: "object", additionalProperties: false,
  properties: {
    projectId: { type: "string", minLength: 1 }, expectedRevision: { type: "integer", minimum: 0 },
    commands: { ...commandSchema, minItems: 1, items: { oneOf: [...commandSchema.items.oneOf, localImageSchema] } },
  }, required: ["projectId", "expectedRevision", "commands"],
} as Parameters<typeof z.fromJSONSchema>[0]);
export const projectSchema = z.strictObject({ projectId: z.string().min(1) });
export const undoSchema = projectSchema.extend({ expectedRevision: z.number().int().nonnegative() });
export const previewSchema = projectSchema.extend({ slideId: z.string().min(1) });
export const createSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(), sourceProjectId: z.string().min(1).optional(),
  aspectRatio: z.enum(["4:5", "1:1", "9:16"]).optional(),
  structure: z.enum(["sequential", "repeating"]).optional(),
  slideCount: z.number().int().min(2).max(20).optional(), outputLanguage: z.string().trim().min(1).optional(),
});
