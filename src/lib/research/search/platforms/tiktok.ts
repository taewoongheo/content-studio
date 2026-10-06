import { browserSearch } from "./browser";
import { parseTikTokSearch } from "../parsers/tiktok";
import { searchUrl, type SearchInput } from "../types";
import type { CollectorContext } from "../../collection/types";
export async function searchTikTok(input: SearchInput, context: CollectorContext) {
  return browserSearch({ input, page: await context.getPage(), signal: context.signal, url: searchUrl(input),
    matches: response => { const url = new URL(response.url()); const keyword = url.searchParams.get("keyword");
      return (!keyword || keyword.toLowerCase() === input.query.toLowerCase()) && url.hostname === "www.tiktok.com" && /^\/api\/search\/(?:user|item|general)/.test(url.pathname); },
    parse: parseTikTokSearch });
}
