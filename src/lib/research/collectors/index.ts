import type { Collector } from "../collection/types";
import { collectInstagram } from "./platforms/instagram";
import { collectTikTok } from "./platforms/tiktok";
import { collectYouTube } from "./platforms/youtube";

import { searchSocial } from "../search/service";

export const collectSocial: Collector = (request, context) => {
  if (request.kind === "search") return searchSocial(request.search, context);
  const collectors = { instagram: collectInstagram, tiktok: collectTikTok, youtube: collectYouTube };
  return collectors[request.source.platform](request, context);
};
