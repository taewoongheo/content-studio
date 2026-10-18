import * as z from "zod/v4";

export const COMPOSITION_LIMIT = 2000;
export const compositionSchema = z.string().trim().max(COMPOSITION_LIMIT).describe(
  "Reusable communication purpose, suitable information formats and volume, visual structure and page flow. Explain what kind of message this template helps communicate (comparison, selection, explanation, actionable steps), without describing the original post's specific topic or claims."
);
export const templateTopicSchema = z.string().trim().min(1).max(200).describe(
  "Reusable content type and scope, not the original post's specific exercise, body part, title or fixed number of items. Follow AGENTS.md template information guidance."
);
export const templateMessageSchema = z.string().trim().min(1).max(2000).describe(
  "Reusable reader purpose: what this format helps the reader compare, choose, understand or do. Do not summarize the source post's specific claims or conclusion."
);
export const requiredCompositionSchema = compositionSchema.min(1);
export const templateSettingsSchema = z.strictObject({
  composition: compositionSchema.optional(),
  templateName: z.string().trim().min(1).max(120).optional(),
  templateTopic: templateTopicSchema.optional(),
  templateMessage: templateMessageSchema.optional(),
  templateOrder: z.number().int().positive().optional(),
}).refine(input => Object.values(input).some(value => value !== undefined), {
  message: "변경할 재사용 설정을 입력해 주세요.",
});
export type TemplateSettingsInput = z.infer<typeof templateSettingsSchema>;

export const templateCreateSchema = z.strictObject({
  slideIds: z.array(z.string().min(1)).min(1).max(20),
  templateName: z.string().trim().min(1).max(120),
  templateTopic: templateTopicSchema,
  templateMessage: templateMessageSchema,
  composition: requiredCompositionSchema,
});
export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
