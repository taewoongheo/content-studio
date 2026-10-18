import type { CollectorContext } from "@/domains/research/collection/types";
import type { SearchInput } from "@/domains/research/search/types";
import { searchTikTok } from "@/domains/research/search/platforms/tiktok";
import { searchInstagram } from "@/domains/research/search/platforms/instagram";
import { searchYouTube } from "@/domains/research/search/platforms/youtube";
export function searchSocial(input: SearchInput, context: CollectorContext) {
  const searchers = { tiktok: searchTikTok, instagram: searchInstagram, youtube: searchYouTube };
  return searchers[input.platform](input, context);
}
