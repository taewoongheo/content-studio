import * as z from "zod/v4";
import { emptyMetrics, type SocialPost } from "../domain/schema";
import { browserBlock } from "../browser/sessions";
import { CollectionBlocked, type Collector } from "../collection/types";

const address = z.object({ url_list: z.array(z.url()).default([]), width: z.number().optional(), height: z.number().optional() });
const count = z.number().int().nonnegative().optional();
const itemSchema = z.object({ id_str: z.string().optional(), id: z.union([z.string(), z.number()]).optional(),
  desc: z.string().default(""), author_info: z.object({ unique_id: z.string().default("") }).optional(),
  image_post_info: z.object({ images: z.array(z.object({ display_image: address })).default([]) }).optional(),
  video_info: z.object({ play_addr: address.optional() }).optional(),
  statistics_info: z.object({ digg_count: count, comment_count: count, share_count: count, play_count: count, collect_count: count }).optional(),
});
export function normalizeTikTok(raw: unknown, sourceUrl: string): SocialPost {
  const item = itemSchema.parse(raw);
  const images = item.image_post_info?.images ?? [];
  const stats = item.statistics_info;
  const media: SocialPost["media"] = images.flatMap(({ display_image: image }) => image.url_list[0]
    ? [{ type: "image" as const, url: image.url_list[0], width: image.width ?? null, height: image.height ?? null }] : []);
  if (!media.length && item.video_info?.play_addr?.url_list[0]) media.push({ type: "video", url: item.video_info.play_addr.url_list[0], width: null, height: null });
  return { id: item.id_str ?? String(item.id), platform: "tiktok", url: sourceUrl,
    author: item.author_info?.unique_id ?? "", text: item.desc,
    format: images.length > 1 ? "slideshow" : images.length ? "image" : "video",
    publishedAt: null, publishedLabel: null, collectedAt: new Date().toISOString(), media,
    metrics: { ...emptyMetrics(), likeCount: stats?.digg_count ?? null, commentCount: stats?.comment_count ?? null,
      shareCount: stats?.share_count ?? null, viewCount: stats?.play_count ?? null, saveCount: stats?.collect_count ?? null } };
}

export const collectTikTok: Collector = async (request, context) => {
  const page = await context.getPage();
  if (request.kind === "account") {
    if (request.cursor) throw new CollectionBlocked("unsupported", "TikTok anonymous account continuation is not supported.");
    const response = await page.goto(request.source.url, { waitUntil: "domcontentloaded" });
    const block = await browserBlock(page, response?.status());
    if (block) throw block;
    // A public creator embed exposes a limited recent sample, not a full feed.
    const embed = await page.context().request.get(`https://www.tiktok.com/embed/@${request.source.id}`, { timeout: 15_000 });
    if (embed.status() === 429) throw new CollectionBlocked("rate_limited", "TikTok creator embed returned HTTP 429.");
    if (embed.status() === 401 || embed.status() === 403) throw new CollectionBlocked("access_denied", `TikTok creator embed returned HTTP ${embed.status()}; no CAPTCHA was confirmed.`);
    if (!embed.ok()) throw new CollectionBlocked("source_error", `TikTok creator embed returned HTTP ${embed.status()}.`);
    const html = await embed.text();
    const stateText = html.match(/<script[^>]*id=["']__FRONTITY_CONNECT_STATE__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
    if (!stateText) throw new CollectionBlocked("unsupported", "TikTok did not expose a usable anonymous creator feed. Direct post URL collection remains available.");
    const state = JSON.parse(stateText) as { source?: { data?: Record<string, { videoList?: Array<{ id?: string; desc?: string; author?: string; playCount?: number }> }> } };
    const entries = Object.values(state.source?.data ?? {}).flatMap(value => value.videoList ?? []);
    if (!entries.length) throw new CollectionBlocked("empty_response", "The public creator embed contained no posts.");
    return { posts: entries.filter(item => item.id).slice(0, request.limit).map(item => ({
      id: item.id!, platform: "tiktok", url: `https://www.tiktok.com/@${request.source.id}/video/${item.id}`,
      author: request.source.id, text: item.desc ?? "", format: "mixed", publishedAt: null,
      publishedLabel: null, collectedAt: new Date().toISOString(), media: [], metrics: { ...emptyMetrics(), viewCount: item.playCount ?? null },
    })), nextCursor: null, warnings: ["Creator embeds provide a limited recent sample; read individual posts to confirm format and media."] };
  }
  const payloadPromise = page.waitForResponse(response => response.url().includes("/player/api/v1/items") && response.status() === 200, { timeout: 20_000 });
  // Attach a rejection handler before navigation so a navigation failure cannot
  // leave an unhandled response-wait promise behind.
  void payloadPromise.catch(() => undefined);
  const response = await page.goto(`https://www.tiktok.com/player/v1/${request.source.id}`, { waitUntil: "domcontentloaded" });
  try {
    const payload = await payloadPromise;
    const data = await payload.json() as { status_code?: number; items?: unknown[] };
    if (!data.items?.length) throw new CollectionBlocked("empty_response", "The TikTok player returned no public post data.");
    const post = normalizeTikTok(data.items[0], request.source.url);
    if (post.id !== request.source.id) throw new CollectionBlocked("source_error", "TikTok returned a different post ID.");
    return { posts: [post], nextCursor: null, warnings: [] };
  } catch (error) {
    const block = await browserBlock(page, response?.status());
    if (block) throw block;
    if (error instanceof CollectionBlocked) throw error;
    throw new CollectionBlocked("empty_response", "The TikTok player did not return usable post data; no CAPTCHA was confirmed.");
  }
};
