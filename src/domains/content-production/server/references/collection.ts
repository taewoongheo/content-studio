import type Database from "better-sqlite3";
import { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";
import { collectVisuals, saveVisuals } from "../publication/visuals";
import { publishChange } from "../events";
import type { Row } from "../../domain/contracts";

const shared = globalThis as typeof globalThis & { externalAccountCollections?: Map<string, Promise<number>> };
const pending = (shared.externalAccountCollections ??= new Map<string, Promise<number>>());
export function collectReferenceAccount(db: Database.Database, username: string, force = false, client = new ApifyAccountPostsClient(), capture = collectVisuals) {
  const key = `${db.name}:${username}`;
  const existing = pending.get(key);
  if (existing) return existing;
  const work = collect();
  pending.set(key, work);
  void work.finally(() => { if (pending.get(key) === work) pending.delete(key); }).catch(() => undefined);
  return work;
  async function collect() {
    const account = db.prepare("SELECT * FROM content_reference_accounts WHERE username=? AND enabled=1").get(username) as Row | undefined;
    if (!account) throw new Error("활성화된 지정 계정이 아닙니다.");
    if (!force && account.last_fetched_at && Date.now() - Date.parse(String(account.last_fetched_at)) < 15 * 60_000) return 0;
    const posts = await client.posts(username);
    if (!db.prepare("SELECT 1 FROM content_reference_accounts WHERE username=? AND enabled=1").get(username))
      throw new Error("수집 중 계정이 제거되거나 비활성화되었습니다.");
    const now = new Date().toISOString();
    db.transaction(() => {
      const insert = db.prepare(`INSERT INTO content_external_references(id,url,account,caption,published_at,observed_at,view_count,like_count,comment_count,save_count,share_count,images_json,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET caption=excluded.caption,published_at=excluded.published_at,observed_at=excluded.observed_at,
        view_count=excluded.view_count,like_count=excluded.like_count,comment_count=excluded.comment_count,save_count=excluded.save_count,share_count=excluded.share_count,images_json=excluded.images_json`);
      for (const post of posts) insert.run(post.id,post.url,username,post.caption,post.published_at,now,post.view_count,post.like_count,post.comment_count,post.save_count,post.share_count,JSON.stringify(post.images),now);
      db.prepare("UPDATE content_reference_accounts SET last_fetched_at=? WHERE username=?").run(now,username);
    })();
    // Preserve images while provider URLs are fresh; later stage queries need no network.
    await Promise.all(posts.map(async post => {
      const row = db.prepare("SELECT visual_set_id,excluded FROM content_external_references WHERE url=?").get(post.url) as Row;
      if (row.visual_set_id || row.excluded) return;
      try {
        const slides = await capture(post.images);
        if (!db.prepare("SELECT 1 FROM content_external_references WHERE id=? AND excluded=0").get(post.id)) return;
        const set = saveVisuals(db,{kind:"reference",url:post.url,slides});
        db.prepare("UPDATE content_external_references SET visual_set_id=?,image_error=NULL WHERE id=?").run(set,post.id);
      } catch {
        db.prepare("UPDATE content_external_references SET image_error=? WHERE id=?").run("Source slide images could not be preserved.",post.id);
      }
    }));
    publishChange({kind:"library"});
    return posts.length;
  }
}
