import { z } from "zod";
import { socialSource } from "@/domains/research/domain/source";
import type { TopicAssignment } from "../topics/model";

const instructions = z.string().trim().max(10000).default("");
const referenceUrl = z.string().trim().transform((value, context) => {
  try {
    const source = socialSource(value, "post");
    if (["tiktok", "youtube"].includes(source.platform)) return source.url;
  } catch { /* Return the same actionable validation message below. */ }
  context.addIssue({ code: "custom", message: "TikTok 게시물 또는 YouTube 커뮤니티 게시글 URL을 입력해 주세요." });
  return z.NEVER;
});
export const productionRequestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("automatic"), instructions }),
  z.object({ mode: z.literal("past_post"), sourceProjectId: z.string().min(1), instructions }),
  z.object({ mode: z.literal("spy_reference"), referenceId: z.string().min(1), instructions }),
  z.object({ mode: z.literal("external_url"), url: referenceUrl, instructions }),
]);
export const productionRequestsSchema = z.array(productionRequestSchema).min(1);
export type ProductionRequest = z.infer<typeof productionRequestSchema>;
export interface PreparedSource {
  id: string;
  project_id?: string;
  name?: string;
  url?: string;
  caption?: string;
  visual_set_id?: string;
  slide_count?: number;
}
export interface ProductionInput {
  request: ProductionRequest;
  /** Automatic requests keep their overlap policy while resolving a production origin. */
  origin?: "internal" | "spy";
  source?: PreparedSource;
  topic_assignment?: TopicAssignment;
}
export const productionModeLabels: Record<ProductionRequest["mode"], string> = {
  spy_reference: "레퍼런스 · 스파이 게시글", automatic: "자동 생성", past_post: "레퍼런스 · 내 게시글", external_url: "외부 URL",
};

export function preservesSourceFormat(mode: ProductionRequest["mode"]) {
  return mode === "past_post" || mode === "spy_reference";
}

/** External references supply composition, never an internal clone origin. */
export function isExternalProduction(input: ProductionRequest["mode"] | ProductionInput) {
  const mode = typeof input === "string" ? input : input.request.mode;
  return mode === "external_url" || mode === "spy_reference"
    || (typeof input !== "string" && mode === "automatic" && input.origin === "spy");
}
