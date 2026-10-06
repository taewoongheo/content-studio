import type { CollectorContext } from "../collection/types";
import type { SearchInput } from "./types";
import { searchTikTok } from "./platforms/tiktok";
import { searchInstagram } from "./platforms/instagram";
import { searchYouTube } from "./platforms/youtube";
export function searchSocial(input: SearchInput, context: CollectorContext) {
  const searchers = { tiktok: searchTikTok, instagram: searchInstagram, youtube: searchYouTube };
  return searchers[input.platform](input, context);
}
