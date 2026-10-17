import type { Collector } from "@/domains/research/collection/types";
import { collectInstagram } from "@/domains/research/collectors/platforms/instagram";
import { collectTikTok } from "@/domains/research/collectors/platforms/tiktok";
import { collectYouTube } from "@/domains/research/collectors/platforms/youtube";

import { searchSocial } from "@/domains/research/search/service";

export const collectSocial: Collector = (request, context) => {
  if (request.kind === "search") return searchSocial(request.search, context);
  const collectors = { instagram: collectInstagram, tiktok: collectTikTok, youtube: collectYouTube };
  return collectors[request.source.platform](request, context);
};
