import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { captureSavedSlideshowRender } from "@/domains/slideshow/server/rendering/input";
import type { ProductionStore } from "./persistence/store";

export function captureSourceProject(store: ProductionStore, projectId: string, slideIds?: string[]) {
  const allowed = store.db.prepare(
    `SELECT 1 FROM content_creation_logs WHERE project_id=? AND post_url IS NOT NULL LIMIT 1`,
  ).get(projectId);
  if (!allowed) throw new Error("게시된 콘텐츠만 참고할 수 있습니다.");
  return captureSavedSlideshowRender(new ContentProjectStore(store.db),projectId,slideIds);
}
