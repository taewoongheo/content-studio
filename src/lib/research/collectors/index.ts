import type { Collector } from "../collection/types";
import { collectInstagram } from "./instagram";
import { collectTikTok } from "./tiktok";
import { collectYouTube } from "./youtube";

export const collectSocial: Collector = (request, context) => {
  const collectors = { instagram: collectInstagram, tiktok: collectTikTok, youtube: collectYouTube };
  return collectors[request.source.platform](request, context);
};
