import type { Collector } from "../collection/types";
import { collectInstagram } from "./instagram";
import { collectTikTok } from "./tiktok";
import { collectYouTube } from "./youtube";

import { searchSocial } from "../search/service";

export const collectSocial: Collector = (request, context) => {
  if (request.kind === "search" && request.search) return searchSocial(request.search, context);
  const collectors = { instagram: collectInstagram, tiktok: collectTikTok, youtube: collectYouTube };
  return collectors[request.source.platform](request, context);
};
