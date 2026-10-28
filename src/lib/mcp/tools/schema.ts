import { requestIdSchema } from "../protocol/requests";
import * as z from "zod/v4";
import { contentMetadataSchema } from "@/domains/slideshow/projects/metadata";
import { localEditorCommandsSchema } from "@/domains/slideshow/editor/local-schema";

export const editSchema = z.fromJSONSchema({
  type: "object", additionalProperties: false,
  properties: {
    expectedTabId: { type: "string", minLength: 1 }, projectId: { type: "string", minLength: 1 }, expectedRevision: { type: "integer", minimum: 0 },
    commands: localEditorCommandsSchema, includeDocument: { type: "boolean", default: true },
  }, required: ["projectId", "expectedTabId", "expectedRevision", "commands"],
} as Parameters<typeof z.fromJSONSchema>[0]);
export const projectSchema = z.strictObject({ projectId: z.string().min(1) });
export const readProjectSchema = projectSchema.extend({
  slideIds: z.array(z.string().min(1)).min(1).max(20).optional(), elementIds: z.array(z.string().min(1)).min(1).max(200).optional(),
  outline: z.boolean().default(false), includeAssets: z.boolean().default(true),
});
export const undoSchema = projectSchema.extend({ expectedTabId: z.string().min(1), expectedRevision: z.number().int().nonnegative() });
export const previewSchema = projectSchema.extend({ slideId: z.string().min(1),
  region: z.object({ x: z.number().min(0).lt(1), y: z.number().min(0).lt(1),
    width: z.number().gt(0).max(1), height: z.number().gt(0).max(1) })
    .refine(value => value.x + value.width <= 1 && value.y + value.height <= 1,
      "Region must fit inside the slide").optional(),
});
export const cloneSchema = z.strictObject({
  requestId: requestIdSchema,
  name: z.string().trim().min(1).max(120).optional(),
  projectId: z.string().min(1),
  topic: contentMetadataSchema.shape.topic.optional(),
  message: contentMetadataSchema.shape.message.optional(),
  content_type: contentMetadataSchema.shape.content_type.optional(),
}).refine(input => [input.topic,input.message,input.content_type].every(value => value === undefined) || [input.topic,input.message,input.content_type].every(value => value !== undefined), { message: "소재·메시지·포맷을 함께 입력해 주세요." });
export const setContentMetadataSchema = projectSchema.extend(contentMetadataSchema.shape);
