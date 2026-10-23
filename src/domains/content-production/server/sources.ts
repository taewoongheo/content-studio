import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { captureSavedSlideshowRender } from "@/domains/slideshow/server/rendering/input";
import type { ProductionStore } from "./persistence/store";

export function captureSourceProject(store: ProductionStore, projectId: string, slideIds?: string[]) {
  const allowed = store.db.prepare(
    `SELECT 1 FROM content_creation_logs WHERE project_id=? AND post_url IS NOT NULL
     UNION ALL SELECT 1 FROM content_references r LEFT JOIN content_creation_logs l ON l.id=r.log_id
     WHERE COALESCE(r.project_id,l.project_id)=? LIMIT 1`,
  ).get(projectId,projectId);
  if (!allowed) throw new Error("게시된 콘텐츠나 직접 지정한 레퍼런스만 참고할 수 있습니다.");
  return captureSavedSlideshowRender(new ContentProjectStore(store.db),projectId,slideIds);
}
