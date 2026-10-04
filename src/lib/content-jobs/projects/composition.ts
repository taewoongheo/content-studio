import * as z from "zod/v4";

export const COMPOSITION_LIMIT = 2000;
export const compositionSchema = z.string().trim().max(COMPOSITION_LIMIT).describe(
  "Visual information structure and page flow: how items are grouped, arranged and repeated, whether alternatives are shown together or individual subjects are explained. Avoid topic-specific suitability, reader outcomes and required content."
);
export const requiredCompositionSchema = compositionSchema.min(1);
export const projectReuseUpdateSchema = z.strictObject({
  composition: compositionSchema.optional(),
  isTemplate: z.boolean().optional(),
}).refine(input => input.composition !== undefined || input.isTemplate !== undefined, {
  message: "변경할 재사용 설정을 입력해 주세요.",
});
export type ProjectReuseUpdate = z.infer<typeof projectReuseUpdateSchema>;
