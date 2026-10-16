import type { SavedProjectSummary } from "./projects/store";

/** Calendar projection only; publication lives on content_projects. */
export type PublishedPost = SavedProjectSummary & { title: string; publishedOn: string };
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
export function toPublishedPost(project: SavedProjectSummary): PublishedPost {
  return { ...project, title: project.name, publishedOn: dateFormatter.format(new Date(project.publishedAt!)) };
}
