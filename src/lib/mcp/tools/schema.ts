import * as z from "zod/v4";
import { compositionSchema, requiredCompositionSchema, contentMetadataSchema, templateTopicSchema, templateMessageSchema } from "@/domains/slideshow/projects/composition";
import { localEditorCommandsSchema } from "@/domains/slideshow/editor/local-schema";

export const editSchema = z.fromJSONSchema({
  type: "object", additionalProperties: false,
  properties: {
    expectedTabId: { type: "string", minLength: 1 }, projectId: { type: "string", minLength: 1 }, expectedRevision: { type: "integer", minimum: 0 },
    commands: localEditorCommandsSchema,
  }, required: ["projectId", "expectedTabId", "expectedRevision", "commands"],
} as Parameters<typeof z.fromJSONSchema>[0]);
export const projectSchema = z.strictObject({ projectId: z.string().min(1) });
export const undoSchema = projectSchema.extend({ expectedTabId: z.string().min(1), expectedRevision: z.number().int().nonnegative() });
export const previewSchema = projectSchema.extend({ slideId: z.string().min(1) });
export const cloneSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  templateProjectId: z.string().min(1),
  topic: contentMetadataSchema.shape.topic.optional(),
  message: contentMetadataSchema.shape.message.optional(),
}).refine(input => (input.topic === undefined) === (input.message === undefined), { message: "주제와 메시지를 함께 입력해 주세요." });
export const setCompositionSchema = projectSchema.extend({ composition: compositionSchema });
export const registerTemplateSchema = projectSchema.extend({
  composition: requiredCompositionSchema.optional(),
  templateName: z.string().trim().min(1).max(120).optional(),
  templateTopic: templateTopicSchema.optional(),
  templateMessage: templateMessageSchema.optional(),
  templateOrder: z.number().int().positive().optional(),
});
export const setContentMetadataSchema = projectSchema.extend(contentMetadataSchema.shape);
