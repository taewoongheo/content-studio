import type Database from "better-sqlite3";
import { ApifyTikTokClient, type ApifyPost } from "@/domains/research/server/apify/client";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";

import { performanceStage } from "../../domain/performance";
import { savePerformance, updateLatestPerformance } from "./store";

const retries = new WeakMap<Database.Database, Map<string, number>>();
const RETRY_DELAY_MS = 60 * 60 * 1000;

export async function collectPerformance(db: Database.Database, client: {posts:(urls:string[]) => Promise<ApifyPost[]>} = new ApifyTikTokClient(), now = Date.now()) {
  const retryAfter = retries.get(db) ?? new Map<string, number>();
  retries.set(db, retryAfter);
  for (const [key, deadline] of retryAfter) if (deadline <= now) retryAfter.delete(key);
  const logs = db.prepare("SELECT id,post_url,actual_published_at FROM content_creation_logs WHERE post_url IS NOT NULL AND actual_published_at IS NOT NULL").all() as {id:string;post_url:string;actual_published_at:string}[];
  for (const log of logs) {
    const stage = performanceStage(log.actual_published_at,now);
    const key = `${log.id}:${stage}`;
    if (!stage || (retryAfter.get(key) ?? 0) > now || db.prepare("SELECT 1 FROM content_performance WHERE log_id=? AND stage=?").get(log.id,stage)) continue;
    try {
      const [post] = await client.posts([log.post_url]);
      db.transaction(() => {
        savePerformance(db,log.id,post,now);
        updateLatestPerformance(db,log.id,post);
      })();
      retryAfter.delete(key);
      notifyProjectsChanged();
    } catch (error) { retryAfter.set(key, now + RETRY_DELAY_MS); console.error("성과 수집 실패", log.id, error); }
  }
}
