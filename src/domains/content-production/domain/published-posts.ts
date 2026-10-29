import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";

export type PublishedPost = SavedProjectSummary & {
  performance?: Array<{stage: "early" | "middle" | "late"; view_count:number|null; like_count:number|null; comment_count:number|null; save_count:number|null; share_count:number|null}>;
  title: string;
  publishedAt: string;
  publishedOn: string;
  postUrl: string;
};
