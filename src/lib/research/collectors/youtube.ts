import { randomUUID } from "node:crypto";
import { Innertube, YTNodes } from "youtubei.js";
import { emptyMetrics, type SocialPost } from "../domain/schema";
import { CollectionBlocked, type Collector } from "../collection/types";

type Feed = Awaited<ReturnType<Innertube["getPost"]>>;
type Continuation = { sessionId: string; accountUrl: string; feed: Feed; remaining: SocialPost[] };
const continuations = new Map<string, Continuation>();

export function displayedCount(text?: string) {
  if (!text) return null;
  const match = text.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([KMB])?$/i);
  if (!match) return null;
  const scale: Record<string, number> = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
  return Math.round(Number(match[1]) * (scale[match[2]?.toUpperCase()] ?? 1));
}
function normalize(post: YTNodes.BackstagePost | YTNodes.Post | YTNodes.SharedPost): SocialPost {
  const original = post instanceof YTNodes.SharedPost ? post.original_post : post;
  const attachment = original?.attachment;
  const images = attachment instanceof YTNodes.PostMultiImage ? attachment.images :
    attachment instanceof YTNodes.BackstageImage ? [attachment] : [];
  const media: SocialPost["media"] = images.flatMap(image => {
    const thumbnail = [...image.image].sort((a, b) => b.width - a.width)[0];
    return thumbnail ? [{ type: "image" as const, url: thumbnail.url, width: thumbnail.width, height: thumbnail.height }] : [];
  });
  const likeLabel = original?.vote_count?.toString();
  const commentLabel = original?.action_buttons?.reply_button?.text;
  return { id: post.id, platform: "youtube", url: `https://www.youtube.com/post/${post.id}`,
    author: post.author?.name ?? "", text: post.content.toString(), publishedAt: null,
    publishedLabel: post.published?.toString() ?? null, collectedAt: new Date().toISOString(),
    format: media.length > 1 ? "slideshow" : media.length ? "image" : attachment ? "mixed" : "text",
    media, metrics: { ...emptyMetrics(), likeCount: displayedCount(likeLabel), commentCount: displayedCount(commentLabel) },
    metricsAsDisplayed: { ...(likeLabel ? { likeCount: likeLabel } : {}), ...(commentLabel ? { commentCount: commentLabel } : {}) } };
}
export function clearYouTubeSession(sessionId: string) {
  for (const [cursor, value] of continuations) if (value.sessionId === sessionId) continuations.delete(cursor);
}
export const collectYouTube: Collector = async (request, context) => {
  let feed: Feed, posts: SocialPost[];
  if (request.cursor) {
    const continuation = continuations.get(request.cursor);
    if (!continuation || continuation.sessionId !== context.sessionId || continuation.accountUrl !== request.source.url)
      throw new CollectionBlocked("not_found", "The account cursor is expired or belongs to another session/account.");
    feed = continuation.feed;
    posts = [...continuation.remaining];
    if (!posts.length && feed.has_continuation) {
      feed = await feed.getContinuation(); posts = feed.posts.map(normalize);
    }
  } else {
    const youtube = await Innertube.create({ retrieve_player: false, generate_session_locally: true,
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([context.signal, AbortSignal.timeout(20_000)]) }) });
    const channelUrl = request.kind === "account" ? request.source.url : request.channelUrl;
    if (!channelUrl) throw new CollectionBlocked("source_error", "YouTube post lookup requires channelUrl. Use list_account_posts to discover the source channel.");
    const endpoint = await youtube.resolveURL(channelUrl);
    const channelId = endpoint.payload.browseId as string | undefined;
    if (!channelId?.startsWith("UC")) throw new CollectionBlocked("source_error", "The supplied YouTube channel URL did not resolve to a channel.");
    feed = request.kind === "post" ? await youtube.getPost(request.source.id, channelId) : await (await youtube.getChannel(channelId)).getCommunity();
    posts = feed.posts.map(normalize);
    if (request.kind === "post") posts = posts.filter(post => post.id === request.source.id);
  }
  if (!posts.length) throw new CollectionBlocked("empty_response", "YouTube returned no public community posts.");
  const selected = posts.slice(0, request.limit);
  let nextCursor: string | null = null;
  if (request.kind === "account" && (posts.length > selected.length || feed.has_continuation)) {
    nextCursor = randomUUID();
    continuations.set(nextCursor, { sessionId: context.sessionId, accountUrl: request.source.url, feed, remaining: posts.slice(selected.length) });
  }
  if (request.cursor) continuations.delete(request.cursor);
  return { posts: selected, nextCursor, warnings: ["Community post view/save/share counts may be unavailable. Abbreviated reaction counts retain their displayed labels."] };
};
