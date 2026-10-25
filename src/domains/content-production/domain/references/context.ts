import { z } from "zod";
export const referenceStepSchema = z.enum(["analysis", "production", "hook", "visual"]);
export type ReferenceStep = z.infer<typeof referenceStepSchema>;
export const REFERENCE_LIMIT = 3;
export const EXTERNAL_CONTEXT = "External reference comparison";
export const externalContextSchema = z.object({
  checked_at: z.string(), queries: z.array(z.string()), collection_attempted: z.boolean(),
  message: z.string(), posts: z.array(z.record(z.string(), z.unknown())).max(REFERENCE_LIMIT),
});
export type ExternalContext = z.infer<typeof externalContextSchema>;
export function readExternalContext(research: unknown): ExternalContext | null {
  if (!Array.isArray(research)) return null;
  const record = research.find(item => item?.question === EXTERNAL_CONTEXT);
  try { return externalContextSchema.parse(JSON.parse(record?.finding)); } catch { return null; }
}
export function externalRecord(context: ExternalContext) {
  return { question: EXTERNAL_CONTEXT, source: "Designated account library", finding: JSON.stringify(context),
    judgment: "External examples expand choices. Their collection does not prove quality or require application. Compare actual images and explain any use." };
}
