import type Database from "better-sqlite3";
import { ApifyTikTokClient, normalizeTikTokUrl, type ApifyPost } from "@/domains/research/server/apify/client";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import { performanceStage } from "../../domain/performance";
import { savePerformance, updateLatestPerformance } from "./store";

export const PERFORMANCE_BATCH_SIZE = 20;
const RETRY_HOURS = [1, 6, 24];
const pending = new WeakMap<Database.Database, Promise<void>>();

export function collectPerformance(db: Database.Database,
  client: {posts:(urls:string[]) => Promise<ApifyPost[]>} = {posts:urls => new ApifyTikTokClient().postsPartial(urls)},
  time: number | (() => number) = Date.now,
) {
  const existing = pending.get(db);
  if (existing) return existing;
  const work = collect().finally(() => { if (pending.get(db) === work) pending.delete(db); });
  pending.set(db,work);
  return work;

  async function collect() {
    const clock = typeof time === "number" ? () => time : time;
    const logs = db.prepare(`SELECT id,post_url,actual_published_at FROM content_creation_logs
      WHERE post_url IS NOT NULL AND actual_published_at IS NOT NULL`).all() as {id:string;post_url:string;actual_published_at:string}[];
    const saved = new Set((db.prepare("SELECT log_id,stage FROM content_performance").all() as {log_id:string;stage:string}[])
      .map(row => `${row.log_id}:${row.stage}`));
    const retries = new Map((db.prepare("SELECT * FROM content_performance_retries").all() as {log_id:string;stage:string;attempts:number;next_retry_at:number}[])
      .map(row => [`${row.log_id}:${row.stage}`,row]));
    const due = logs.flatMap(log => {
      const stage = performanceStage(log.actual_published_at,clock()), key = `${log.id}:${stage}`;
      return stage && !saved.has(key) && (retries.get(key)?.next_retry_at ?? 0) <= clock() ? [{...log,stage,key}] : [];
    });
    const reserve = db.prepare(`INSERT INTO content_performance_retries VALUES(?,?,?,?)
      ON CONFLICT(log_id,stage) DO UPDATE SET attempts=excluded.attempts,next_retry_at=excluded.next_retry_at`);
    const clear = db.prepare("DELETE FROM content_performance_retries WHERE log_id=?");
    const postpone = db.prepare("UPDATE content_performance_retries SET next_retry_at=? WHERE log_id=? AND stage=?");
    const exists = db.prepare("SELECT post_url FROM content_creation_logs WHERE id=?");
    for (let offset=0; offset<due.length; offset+=PERFORMANCE_BATCH_SIZE) {
      const batch = due.slice(offset,offset+PERFORMANCE_BATCH_SIZE).filter(log => exists.get(log.id));
      if (!batch.length) continue;
      // Reserve before the paid call so a process restart cannot immediately repeat an uncertain request.
      const deadlines = new Map<string,number>();
      db.transaction(() => {
        for (const log of batch) {
          const attempts = (retries.get(log.key)?.attempts ?? 0)+1;
          const delay = RETRY_HOURS[Math.min(attempts-1,RETRY_HOURS.length-1)]*3600000;
          deadlines.set(log.id,delay);
          reserve.run(log.id,log.stage,attempts,clock()+delay);
        }
      })();
      let posts: ApifyPost[] = [];
      try { posts = await client.posts(batch.map(log => log.post_url)); }
      catch (error) { console.error("성과 묶음 수집 실패",error); }
      const byId = new Map(posts.map(post => [post.id,post]));
      let changed = false;
      db.transaction(() => {
        for (const log of batch) {
          const current = exists.get(log.id) as {post_url:string}|undefined;
          if (!current || current.post_url !== log.post_url) continue;
          const post = byId.get(normalizeTikTokUrl(log.post_url).id);
          if (!post) {
            postpone.run(clock()+deadlines.get(log.id)!,log.id,log.stage);
            continue;
          }
          const observedAt = clock();
          savePerformance(db,log.id,post,observedAt);
          updateLatestPerformance(db,log.id,post,new Date(observedAt).toISOString());
          clear.run(log.id);
          changed = true;
        }
      })();
      if (changed) notifyProjectsChanged();
    }
  }
}
