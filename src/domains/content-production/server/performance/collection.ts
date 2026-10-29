import type Database from "better-sqlite3";
import { ApifyTikTokClient, type ApifyPost } from "@/domains/research/server/apify/client";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";

export function performanceStage(publishedAt: string, now = Date.now()): "early" | "middle" | "late" | null {
  const days = (now - Date.parse(publishedAt)) / 86400000;
  return days >= 7 ? "late" : days >= 3 ? "middle" : days >= 1 ? "early" : null;
}
export function savePerformance(db: Database.Database, id: string, post: ApifyPost, now = Date.now()) {
  const log = db.prepare("SELECT actual_published_at FROM content_creation_logs WHERE id=?").get(id) as {actual_published_at:string}|undefined;
  const stage = log && performanceStage(log.actual_published_at, now);
  if (!stage) return;
  db.prepare(`INSERT OR IGNORE INTO content_performance(log_id,stage,view_count,like_count,comment_count,save_count,share_count)
    VALUES(?,?,?,?,?,?,?)`).run(id,stage,post.view_count,post.like_count,post.comment_count,post.save_count,post.share_count);
}
/** Reuse existing observations according to their age when actually collected. */
export function backfillPerformance(db: Database.Database) {
  return db.prepare(`INSERT OR IGNORE INTO content_performance
    (log_id,stage,view_count,like_count,comment_count,save_count,share_count)
    SELECT id,CASE WHEN julianday(observed_at)-julianday(actual_published_at)>=7 THEN 'late'
      WHEN julianday(observed_at)-julianday(actual_published_at)>=3 THEN 'middle' ELSE 'early' END,
      view_count,like_count,comment_count,save_count,share_count
    FROM content_creation_logs WHERE post_url IS NOT NULL
      AND julianday(observed_at)-julianday(actual_published_at)>=1
      AND (view_count IS NOT NULL OR like_count IS NOT NULL OR comment_count IS NOT NULL OR save_count IS NOT NULL OR share_count IS NOT NULL)`)
    .run().changes;
}
export async function collectPerformance(db: Database.Database, client: {posts:(urls:string[]) => Promise<ApifyPost[]>} = new ApifyTikTokClient(), now = Date.now()) {
  const logs = db.prepare("SELECT id,post_url,actual_published_at FROM content_creation_logs WHERE post_url IS NOT NULL AND actual_published_at IS NOT NULL").all() as {id:string;post_url:string;actual_published_at:string}[];
  for (const log of logs) {
    const stage = performanceStage(log.actual_published_at,now);
    if (!stage || db.prepare("SELECT 1 FROM content_performance WHERE log_id=? AND stage=?").get(log.id,stage)) continue;
    try {
      const [post] = await client.posts([log.post_url]);
      db.transaction(() => {
        savePerformance(db,log.id,post,now);
        db.prepare("UPDATE content_creation_logs SET view_count=?,like_count=?,comment_count=?,save_count=?,share_count=?,observed_at=? WHERE id=?")
          .run(post.view_count,post.like_count,post.comment_count,post.save_count,post.share_count,new Date().toISOString(),log.id);
      })();
      notifyProjectsChanged();
    } catch (error) { console.error("성과 수집 실패", log.id, error); }
  }
}
