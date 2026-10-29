import type { StagePerformance } from "./performance";
import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";

export type PublishedPost = SavedProjectSummary & {
  performance?: StagePerformance[];
  title: string;
  publishedAt: string;
  publishedOn: string;
  postUrl: string;
};

export type ContentOverview = {
  projects: SavedProjectSummary[];
  posts: PublishedPost[];
};
