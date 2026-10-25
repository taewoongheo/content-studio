import { recentKoreanDate, type PerformanceRecord } from "../../domain/performance";
export { recentKoreanDate } from "../../domain/performance";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import type Database from "better-sqlite3";
import {
  ApifyTikTokClient,
  normalizeTikTokUrl,
  type ApifyPost,
} from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "./visuals";
import { publishChange } from "../events";
import type { Row } from "../../domain/contracts";
const metricsKeys = [
  "view_count",
  "like_count",
  "comment_count",
  "save_count",
  "share_count",
] as const;
export function updateMetrics(
  db: Database.Database,
  id: string,
  post: ApifyPost,
) {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE content_creation_logs SET ${metricsKeys.map((k) => `${k}=?`).join(",")},observed_at=?,updated_at=? WHERE id=?`,
  ).run(...metricsKeys.map((k) => post[k]), now, now, id);
}
export async function refreshMetrics(
  db: Database.Database,
  signal?: AbortSignal,
  client = new ApifyTikTokClient(),
  onSnapshot?: (records: PerformanceRecord[]) => void,
) {
  const read = () => db.prepare(
    "SELECT l.id AS log_id,l.project_id,COALESCE(p.name,l.topic,'콘텐츠') AS name,l.post_url,l.actual_published_at,l.observed_at,l.view_count,l.like_count,l.save_count,l.comment_count,l.share_count FROM content_creation_logs l LEFT JOIN content_projects p ON p.id=l.project_id WHERE l.post_url IS NOT NULL AND l.actual_published_at IS NOT NULL ORDER BY l.actual_published_at DESC",
  ).all() as PerformanceRecord[];
  const targets = read().filter(record => recentKoreanDate(record.actual_published_at));
  onSnapshot?.(targets);
  if (!targets.length) return 0;
  const posts = await client.posts(
    targets.map((r) => r.post_url),
    signal,
  );
  signal?.throwIfAborted();
  db.transaction(() =>
    targets.forEach((target, i) => updateMetrics(db, target.log_id, posts[i])),
  )();
  const ids = new Set(targets.map(record => record.log_id));
  onSnapshot?.(read().filter(record => ids.has(record.log_id)));
  return targets.length;
}
const registrations = new Map<string, Promise<unknown>>();
export function registerPublication(
  db: Database.Database,
  logId: string,
  url: string,
) {
  if (registrations.has(logId)) return registrations.get(logId)!;
  const promise = registerPost(db, logId, url).finally(() =>
    registrations.delete(logId),
  );
  registrations.set(logId, promise);
  return promise;
}
async function registerPost(db: Database.Database, logId: string, raw: string) {
  const { url } = normalizeTikTokUrl(raw);
  const log = db
    .prepare("SELECT * FROM content_creation_logs WHERE id=?")
    .get(logId) as Row | undefined;
  if (!log) throw new Error("로그를 찾을 수 없습니다.");
  if (log.completed_at) {
    if (log.post_url !== url)
      throw new Error("이미 다른 게시물이 연결되어 있습니다.");
    return { completed: true };
  }
  const duplicate = db
    .prepare("SELECT id FROM content_creation_logs WHERE post_url=? AND id<>?")
    .get(url, logId);
  if (duplicate) throw new Error("다른 콘텐츠에 연결된 URL입니다.");
  const task = db
    .prepare("SELECT id,state,project_id FROM content_drafts WHERE log_id=?")
    .get(logId) as { id: string; state: string; project_id: string | null } | undefined;
  if (task && task.state !== "finished")
    throw new Error("제작 종료 후 URL을 등록해 주세요.");
  if (!(task?.project_id ?? log.project_id))
    throw new Error("게시할 프로젝트가 없습니다.");
  const [post] = await new ApifyTikTokClient().posts([url]);
  if (!post.published_at)
    throw new Error("실제 게시 시각이 반환되지 않았습니다.");
  const slides = await collectVisuals(post.images);
  finalizePublication(db, logId, url, post, slides, task?.id);
  notifyProjectsChanged();
  publishChange({ kind: "library" });
  return { completed: true };
}


// Collection happens before this transaction. Recheck ownership after that await.
export function finalizePublication(
  db: Database.Database, logId: string, url: string, post: ApifyPost,
  slides: Parameters<typeof saveVisuals>[1]["slides"], expectedDraftId?: string,
) {
  db.transaction(() => {
    const log = db.prepare("SELECT * FROM content_creation_logs WHERE id=?").get(logId) as Row | undefined;
    if (!log) throw new Error("삭제된 작업은 게시할 수 없습니다.");
    const draft = db.prepare("SELECT * FROM content_drafts WHERE log_id=?").get(logId) as Row | undefined;
    if (expectedDraftId && (!draft || draft.id !== expectedDraftId || draft.state !== "finished"))
      throw new Error("작업 상태가 변경되었습니다. 다시 확인해 주세요.");
    const projectId = draft?.project_id ?? log.project_id;
    if (!projectId) throw new Error("게시할 프로젝트가 없습니다.");
    if (log.completed_at) {
      if (log.post_url !== url) throw new Error("이미 다른 게시물이 연결되어 있습니다.");
      return;
    }
    const summary = log.content_summary_json ? JSON.parse(String(log.content_summary_json)) : {};
    if (draft) {
      // Keep the reasoning and research after removing the resumable drafts.
      summary.draft_context = {
        analysis: db.prepare("SELECT * FROM content_analysis_drafts WHERE draft_id=?").get(draft.id),
        production: db.prepare("SELECT * FROM content_production_drafts WHERE draft_id=?").get(draft.id),
        hook: db.prepare("SELECT * FROM content_hook_drafts WHERE draft_id=?").get(draft.id),
        visual: db.prepare("SELECT * FROM content_visual_drafts WHERE draft_id=?").get(draft.id),
        polish: db.prepare("SELECT * FROM content_polish_drafts WHERE draft_id=?").get(draft.id),
      };
    }
    saveVisuals(db, { kind: "published", log_id: logId, url, slides });
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE content_creation_logs SET project_id=?,content_summary_json=?,platform='tiktok',post_url=?,actual_published_at=?,completed_at=?,updated_at=? WHERE id=?",
    ).run(projectId, JSON.stringify(summary), url, post.published_at, now, now, logId);
    updateMetrics(db, logId, post);
    if (draft) db.prepare("DELETE FROM content_drafts WHERE id=?").run(draft.id);
  })();
}
