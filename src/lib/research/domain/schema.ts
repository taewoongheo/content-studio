import * as z from "zod/v4";

export const platformSchema = z.enum(["instagram", "tiktok", "youtube"]);
export const formatSchema = z.enum(["slideshow", "image", "video", "text", "mixed"]);
const count = z.number().int().nonnegative().nullable();
export const metricsSchema = z.strictObject({
  likeCount: count, viewCount: count, saveCount: count, commentCount: count, shareCount: count,
});
export const criteriaSchema = z.strictObject({
  format: formatSchema.optional(),
  minViews: z.number().int().nonnegative().optional(),
  minLikes: z.number().int().nonnegative().optional(),
});
export const postSchema = z.strictObject({
  id: z.string(), platform: platformSchema, url: z.url(), author: z.string(),
  text: z.string(), format: formatSchema, publishedAt: z.string().nullable(),
  publishedLabel: z.string().nullable(), collectedAt: z.iso.datetime(), metrics: metricsSchema,
  metricsAsDisplayed: z.record(z.string(), z.string()).optional(),
  media: z.array(z.strictObject({
    type: z.enum(["image", "video"]), url: z.url(),
    width: z.number().nonnegative().nullable(), height: z.number().nonnegative().nullable(),
  })),
});
export type Platform = z.infer<typeof platformSchema>;
export type SocialPost = z.infer<typeof postSchema>;
export type ResearchCriteria = z.infer<typeof criteriaSchema>;
export const emptyMetrics = (): SocialPost["metrics"] => ({
  likeCount: null, viewCount: null, saveCount: null, commentCount: null, shareCount: null,
});

export function evaluateCriteria(post: SocialPost, criteria: ResearchCriteria = {}) {
  const failed: string[] = [], unknown: string[] = [];
  if (criteria.format && post.format !== criteria.format) failed.push(`format must be ${criteria.format}`);
  for (const [threshold, metric] of [[criteria.minViews, "viewCount"], [criteria.minLikes, "likeCount"]] as const) {
    if (threshold === undefined) continue;
    const value = post.metrics[metric];
    if (value === null) unknown.push(`${metric} is not exposed by the source`);
    else if (value < threshold) failed.push(`${metric} ${value} is below ${threshold}`);
  }
  return { status: failed.length ? "failed" : unknown.length ? "unverified" : "passed",
    reasons: [...failed, ...unknown] };
}
