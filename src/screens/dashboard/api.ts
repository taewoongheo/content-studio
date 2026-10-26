import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { readJson } from "@/domains/slideshow/client/http";

export async function listPublishedPosts() {
  return readJson<PublishedPost[]>(await fetch("/api/published-content", { cache: "no-store" }));
}
