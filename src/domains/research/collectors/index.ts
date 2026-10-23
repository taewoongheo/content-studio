import type { Collector } from "@/domains/research/collection/types";
import { CollectionBlocked } from "@/domains/research/collection/types";
import { collectYouTube } from "./platforms/youtube";
import { searchYouTube } from "@/domains/research/search/platforms/youtube";

export const collectSocial: Collector = (request, context) => {
  if (request.source.platform !== "youtube")
    throw new CollectionBlocked("unsupported", "This collector supports YouTube only.");
  return request.kind === "search" ? searchYouTube(request.search, context) : collectYouTube(request, context);
};
