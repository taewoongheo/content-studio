import { Innertube, YTNodes } from "youtubei.js";
import { emptyMetrics, type SocialPost } from "../../domain/schema";
import type { CollectorContext } from "../../collection/types";
import type { SearchInput, SocialAccount } from "../types";
export async function searchYouTube(input: SearchInput, context: CollectorContext) {
  const youtube = await Innertube.create({ retrieve_player: false, generate_session_locally: true,
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.any([context.signal, AbortSignal.timeout(20_000)]) }) });
  const result = await youtube.search(input.query, { type: input.type === "accounts" ? "channel" : "video" });
  const accounts: SocialAccount[] = [], posts: SocialPost[] = [];
  for (const node of result.results) {
    if (accounts.length + posts.length >= input.limit) break;
    if (node instanceof YTNodes.Channel) accounts.push({ id: node.id, platform: "youtube", username: node.author.name,
      name: node.author.name, url: `https://www.youtube.com/channel/${node.id}`, followerCount: null });
    if (node instanceof YTNodes.Video) posts.push({ id: node.id, platform: "youtube", url: `https://www.youtube.com/watch?v=${node.id}`,
      author: node.author.name, text: node.title.toString(), format: "video", publishedAt: null,
      publishedLabel: node.published?.toString() ?? null, collectedAt: new Date().toISOString(), media: [],
      metrics: emptyMetrics(), metricsAsDisplayed: { ...(node.view_count ? { viewCount: node.view_count.toString() } : {}) } });
  }
  return { accounts, posts, nextCursor: null, warnings: input.type === "posts" ?
    ["YouTube native search returns videos, not community posts. Use account search then list_account_posts for community content. View labels are displayed text, not verified exact counts."] : [] };
}
