import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { readJson } from "@/domains/slideshow/client/http";

export async function listContentOverview() {
  return readJson<{posts:PublishedPost[];projects:import("@/domains/slideshow/domain/projects").SavedProjectSummary[]}>(await fetch("/api/published-content?all=true", {cache:"no-store"}));
}
