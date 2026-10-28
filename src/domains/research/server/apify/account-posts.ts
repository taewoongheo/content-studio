import { normalizeTikTokUrl, parseApifyItem } from "./client";
import { isMediaUrl } from "../../domain/source";

export interface AccountPostsOptions { limit?: number; allLanguages?: boolean; sorting?: "latest" | "popular" }

export function parseAccountPhotos(raw: unknown, username: string, options: AccountPostsOptions = {}) {
  if (!Array.isArray(raw)) throw new Error("Apify의 계정 게시글 배열을 확인할 수 없습니다.");
  const seen = new Set<string>();
  let owned = 0;
  const posts = raw.slice(0, options.limit ?? 12).flatMap(value => {
    let post;
    try { post = parseApifyItem(value); } catch { return []; }
    if (!post.url) return [];
    let source;
    try { source = normalizeTikTokUrl(post.url); } catch { return []; }
    if (source.id !== post.id) return [];
    const account = new URL(source.url).pathname.split("/")[1].slice(1);
    if (account.toLowerCase() !== username.toLowerCase()) return [];
    const metadataAuthor = (value as {authorMeta?:{name?:string}}).authorMeta?.name;
    if (metadataAuthor && metadataAuthor.toLowerCase() !== username.toLowerCase()) return [];
    owned++;
    const language = (value as {textLanguage?:string}).textLanguage ?? null;
    if (!options.allLanguages && language && !["en","eng","un","und"].includes(language)) return [];
    if ((value as {isSlideshow?:boolean}).isSlideshow === false) return [];
    const images = post.images.filter(isMediaUrl);
    if (images.length < 2 || seen.has(post.id)) return [];
    seen.add(post.id);
    const complete = post.view_count !== null && post.view_count > 0 && post.like_count !== null && post.comment_count !== null && post.save_count !== null;
    return [{ ...post, url: source.url.replace("/video/","/photo/"), account, caption:post.text, language, images,
      engagement_rate:complete?(post.like_count!+post.comment_count!+post.save_count!)/post.view_count!:null }];
  });
  if (raw.length && !owned) throw new Error("수집 결과의 작성자가 지정 계정과 일치하지 않습니다. 자료를 저장하지 않았습니다.");
  return posts;
}
export class ApifyAccountPostsClient {
  constructor(private token = process.env.APIFY_API_TOKEN, private transport: typeof fetch = fetch) {}
  async posts(username: string, signal?: AbortSignal, options: AccountPostsOptions = {}) {
    return (await this.postsWithCount(username, signal, options)).posts;
  }
  async postsWithCount(username: string, signal?: AbortSignal, options: AccountPostsOptions = {}) {
    if (!/^[a-zA-Z0-9_.]+$/.test(username)) throw new Error("TikTok 계정을 확인해 주세요.");
    if (!this.token?.trim()) throw new Error("서버의 APIFY_API_TOKEN을 설정해 주세요.");
    const response = await this.transport(
      "https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?timeout=240&format=json&clean=true&maxTotalChargeUsd=0.5",
      {
        method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profiles:[username], resultsPerPage:options.limit ?? 12, profileScrapeSections:["videos"],profileSorting:options.sorting ?? "latest",excludePinnedPosts:true,
          shouldDownloadVideos:false,shouldDownloadSlideshowImages:false,scrapeRelatedVideos:false }),
        signal:signal?AbortSignal.any([signal,AbortSignal.timeout(250000)]):AbortSignal.timeout(250000),cache:"no-store",
      },
    );
    if (!response.ok) throw new Error(`Apify 계정 조회 실패 (${response.status}). 키·크레딧·계정 상태를 확인해 주세요.`);
    const raw: unknown = await response.json();
    const posts = parseAccountPhotos(raw, username, options);
    return { posts, fetchedCount: (raw as unknown[]).length };
  }
}
