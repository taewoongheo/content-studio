import { browserSearch } from "@/domains/research/search/platforms/browser";
import { parseTikTokSearch } from "@/domains/research/search/parsers/tiktok";
import { searchUrl, type SearchInput } from "@/domains/research/search/types";
import type { CollectorContext } from "@/domains/research/collection/types";
export async function searchTikTok(input: SearchInput, context: CollectorContext) {
  return browserSearch({ input, page: await context.getPage(), signal: context.signal, url: searchUrl(input),
    matches: response => { const url = new URL(response.url()); const keyword = url.searchParams.get("keyword");
      return (!keyword || keyword.toLowerCase() === input.query.toLowerCase()) && url.hostname === "www.tiktok.com" && /^\/api\/search\/(?:user|item|general)/.test(url.pathname); },
    parse: parseTikTokSearch });
}
