import { z } from "zod";
import { normalizeTikTokUrl } from "./client";
import { isMediaUrl } from "../../domain/source";

const count = z.number().finite().nonnegative().nullable().default(null);
const photoSchema = z.object({
  id: z.string(), url: z.string(), username: z.string().nullable().default(null),
  description: z.string().nullable().default(null), mediaType: z.string(),
  textLanguage: z.string().nullable().default(null), imageUrls: z.array(z.string()).default([]),
  createTimeIso: z.string().nullable().default(null),
  viewsCount: count, likesCount: count, commentsCount: count, savesCount: count, sharesCount: count,
});
export function parsePhotoSearch(raw: unknown) {
  const rows = z.array(z.unknown()).parse(raw);
  const seen = new Set<string>();
  return rows.flatMap(raw => {
    const parsed = photoSchema.safeParse(raw);
    if (!parsed.success) return [];
    const p = parsed.data;
    if (p.mediaType !== "photo" || (p.textLanguage && !["en", "eng", "un", "und"].includes(p.textLanguage))) return [];
    let source;
    try { source = normalizeTikTokUrl(p.url); } catch { return []; }
    if (!source.url.includes("/photo/") || source.id !== p.id || seen.has(p.id)) return [];
    const images = p.imageUrls.filter(isMediaUrl);
    if (images.length < 2) return [];
    seen.add(p.id);
    const complete = p.viewsCount !== null && p.viewsCount > 0 && p.likesCount !== null && p.commentsCount !== null && p.savesCount !== null;
    return [{
      id: p.id, url: source.url, account: p.username, caption: p.description ?? "",
      language: p.textLanguage, published_at: p.createTimeIso, images,
      view_count: p.viewsCount, like_count: p.likesCount, comment_count: p.commentsCount,
      save_count: p.savesCount, share_count: p.sharesCount,
      engagement_rate: complete ? (p.likesCount! + p.commentsCount! + p.savesCount!) / p.viewsCount! : null,
    }];
  }).slice(0, 5);
}
export class ApifyPhotoSearchClient {
  constructor(private token = process.env.APIFY_API_TOKEN, private transport: typeof fetch = fetch) {}
  async search(query: string) {
    if (!this.token?.trim()) throw new Error("서버의 APIFY_API_TOKEN을 설정해 주세요.");
    const response = await this.transport(
      "https://api.apify.com/v2/acts/scrapingmonkey~tiktok-scraper/run-sync-get-dataset-items?timeout=240&format=json&clean=true&maxTotalChargeUsd=0.10",
      {
        method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "searchPhotos", searchTerms: [query], maxResults: 5, maxTotalResults: 5,
          country: "US", language: "en", sort: "popular", enrichPartialResults: true }),
        signal: AbortSignal.timeout(250000), cache: "no-store",
      },
    );
    if (!response.ok) throw new Error(`Apify 사진 검색 실패 (${response.status}). 키·크레딧·Actor 상태를 확인해 주세요.`);
    return parsePhotoSearch(await response.json());
  }
}
