import type { ContentOverview } from "@/domains/content-production/domain/published-posts";
import { readJson } from "@/domains/slideshow/client/http";

export async function listContentOverview() {
  return readJson<ContentOverview>(await fetch("/api/published-content?all=true", {cache:"no-store"}));
}
