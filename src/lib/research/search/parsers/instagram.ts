import { emptyMetrics, type SocialPost } from "../../domain/schema";
import type { SocialAccount } from "../types";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === "object" ? value as ObjectValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value : "";
const count = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
const mediaUrl = (value: unknown) => { try { const url = new URL(text(value)); return url.protocol === "https:" ? url.toString() : ""; } catch { return ""; } };
function mediaImages(raw: ObjectValue): SocialPost["media"] {
  const carousel = array(raw.carousel_media);
  const children = carousel.length ? carousel : [raw];
  return children.flatMap<SocialPost["media"][number]>(child => {
    const node = object(child);
    const image = object(array(object(node.image_versions2).candidates)[0]);
    const video = object(array(node.video_versions)[0]);
    const videoLink = mediaUrl(video.url), imageLink = mediaUrl(image.url);
    if (videoLink) return [{ type: "video" as const, url: videoLink, width: count(video.width), height: count(video.height) }];
    return imageLink ? [{ type: "image" as const, url: imageLink, width: count(image.width), height: count(image.height) }] : [];
  });
}
function post(raw: ObjectValue): SocialPost | undefined {
  const code = text(raw.code ?? raw.shortcode), author = text(object(raw.user).username);
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return;
  const media = mediaImages(raw);
  const allImages = media.every(item => item.type === "image");
  return { id: code, platform: "instagram", url: `https://www.instagram.com/p/${code}/`, author,
    text: text(object(raw.caption).text), format: array(raw.carousel_media).length ? (allImages ? "slideshow" : "mixed") : raw.media_type === 2 ? "video" : "image",
    media, publishedAt: typeof raw.taken_at === "number" && raw.taken_at > 0 && raw.taken_at < 10_000_000_000 ? new Date(raw.taken_at * 1000).toISOString() : null,
    publishedLabel: null, collectedAt: new Date().toISOString(), metrics: { ...emptyMetrics(), likeCount: count(raw.like_count),
      commentCount: count(raw.comment_count), viewCount: count(raw.play_count ?? raw.view_count) } };
}
export function parseInstagramSearch(payload: unknown) {
  const accounts = new Map<string, SocialAccount>(), posts = new Map<string, SocialPost>();
  let visited = 0;
  const containers: unknown[] = [];
  const root = object(payload);
  if (Array.isArray(root.users)) containers.push({ users: root.users });
  if (root.media_grid) containers.push({ media_grid: root.media_grid });
  function findSerp(value: unknown, depth: number) {
    if (depth > 5) return;
    for (const [key, child] of Object.entries(object(value))) {
      if (/fbsearch.*(?:serp|topsearch)/i.test(key)) containers.push(child);
      else if (child && typeof child === "object" && !Array.isArray(child)) findSerp(child, depth + 1);
    }
  }
  findSerp(payload, 0);
  // SERP GraphQL responses nest users/media in sections. Walk only a bounded
  // response and normalize actual media records, never infer post text from UI.
  function walk(value: unknown, depth: number) {
    if (depth > 14 || ++visited > 5000) return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach(item => walk(item, depth + 1)); return; }
    const node = object(value);
    const username = text(node.username);
    if (/^[A-Za-z0-9_.]+$/.test(username)) {
      accounts.set(username, { id: String(node.pk ?? node.id ?? username), platform: "instagram", username,
        name: text(node.full_name), url: `https://www.instagram.com/${username}/`, followerCount: count(node.follower_count) });
    }
    if ((node.code || node.shortcode) && (node.media_type || node.image_versions2 || node.carousel_media)) {
      const normalized = post(node); if (normalized) posts.set(normalized.id, normalized);
    }
    Object.values(node).forEach(item => { if (item && typeof item === "object") walk(item, depth + 1); });
  }
  containers.forEach(container => walk(container, 0));
  return { accounts: [...accounts.values()], posts: [...posts.values()], recognized: containers.length > 0 };
}
