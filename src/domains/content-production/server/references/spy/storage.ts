import type Database from "better-sqlite3";
import type { SpyPost } from "@/domains/research/server/apify/spy-posts";
export function saveSpyPosts(db: Database.Database, account: string, posts: SpyPost[], now=new Date().toISOString()) {
  db.transaction(()=>{
    const insert=db.prepare(`INSERT INTO content_external_references(id,url,account,caption,published_at,observed_at,view_count,like_count,comment_count,save_count,share_count,images_json,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`);
    for (const post of posts) insert.run(post.id,post.url,account,post.text,post.published_at,now,post.view_count,post.like_count,post.comment_count,post.save_count,post.share_count,JSON.stringify(post.images),now);
    db.prepare("UPDATE content_reference_accounts SET last_fetched_at=? WHERE username=?").run(now,account);
  })();
}
