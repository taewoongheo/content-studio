import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";

export type PublishedPost = SavedProjectSummary & {
  title: string;
  publishedAt: string;
  publishedOn: string;
  postUrl: string;
};
