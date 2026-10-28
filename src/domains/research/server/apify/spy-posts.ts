import { normalizeTikTokUrl, parseApifyItem } from "./client";
import { isMediaUrl } from "../../domain/source";
export type SpyPost = ReturnType<typeof parseApifyItem> & { account: string; url: string };
export class ApifySpyClient {
  constructor(private token = process.env.APIFY_API_TOKEN, private transport: typeof fetch = fetch) {}
  async posts(accounts: string[], limit: number): Promise<Map<string, SpyPost[]>> {
    if (!accounts.length) return new Map();
    if (!this.token?.trim()) throw new Error("APIFY_API_TOKEN을 설정해 주세요.");
    if (accounts.some(account => !/^[a-zA-Z0-9_.]+$/.test(account))) throw new Error("잘못된 TikTok 계정입니다.");
    const response = await this.transport("https://api.apify.com/v2/acts/clockworks~tiktok-scraper/run-sync-get-dataset-items?timeout=240&format=json&clean=true", {
      method:"POST",headers:{Authorization:`Bearer ${this.token}`,"Content-Type":"application/json"},
      body:JSON.stringify({profiles:accounts,resultsPerPage:limit,profileSorting:"latest",profileScrapeSections:["videos"],excludePinnedPosts:true,
        shouldDownloadVideos:false,shouldDownloadSlideshowImages:false,scrapeRelatedVideos:false}),
      signal:AbortSignal.timeout(250000),cache:"no-store",
    });
    if (!response.ok) throw new Error(`Apify 계정 조회 실패 (${response.status})`);
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("게시글 목록을 확인할 수 없습니다.");
    const result = new Map(accounts.map(account => [account, [] as SpyPost[]]));
    for (const value of raw) {
      const post = parseApifyItem(value);
      if (!post.url) throw new Error("게시글 URL이 없는 수집 결과입니다.");
      const source = normalizeTikTokUrl(post.url);
      const account = new URL(source.url).pathname.split('/')[1].slice(1).toLowerCase();
      const author = (value as {authorMeta?:{name?:string}}).authorMeta?.name;
      if (source.id !== post.id || !result.has(account) || (author && author.toLowerCase() !== account)) throw new Error("수집 게시글의 계정·ID가 일치하지 않습니다.");
      const posts = result.get(account)!;
      if (!posts.some(item => item.id === post.id)) posts.push({...post,url:source.url,account,images:post.images.filter(isMediaUrl)});
    }
    return result;
  }
}
