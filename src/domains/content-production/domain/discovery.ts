import { z } from "zod";

export const DISCOVERY_QUESTION = "Shared TikTok discovery batch";
const metric = z.number().nonnegative().nullable();
export const discoverySchema = z.object({
  query: z.string(), collected_at: z.string(), posts: z.array(z.object({
    id: z.string(), url: z.string().url(), account: z.string().nullable(), caption: z.string(),
    language: z.string().nullable(), published_at: z.string().nullable(),
    view_count: metric, like_count: metric, comment_count: metric, save_count: metric, share_count: metric,
    engagement_rate: metric, visual_set_id: z.string().nullable(), slide_count: z.number().int().nonnegative(),
    image_error: z.string().nullable(),
  })).max(5),
});
export type DiscoveryBatch = z.infer<typeof discoverySchema>;
export function discoveryRecord(batch: DiscoveryBatch) {
  return { question: DISCOVERY_QUESTION, source: "Apify Photo Search", finding: JSON.stringify(batch),
    judgment: "Shared search candidates, not prevalidated winners. Inspect actual slides, audience relevance and response metrics before using them." };
}
export function readDiscovery(research: unknown): DiscoveryBatch | null {
  if (!Array.isArray(research)) return null;
  const record = research.find(item => item?.question === DISCOVERY_QUESTION);
  try { return discoverySchema.parse(JSON.parse(record?.finding)); } catch { return null; }
}
