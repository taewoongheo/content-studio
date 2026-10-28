import type Database from "better-sqlite3";
import { socialSource } from "@/domains/research/domain/source";
import type { Row } from "../../domain/contracts";
import { publishChange } from "../events";
import { readContentMetadata, type ContentMetadata } from "@/domains/content-metadata/schema";

export function accountIdentity(raw: string) {
  const source = socialSource(raw.startsWith("https://") ? raw : `https://www.tiktok.com/@${raw.replace(/^@/, "")}`, "account");
  if (source.platform !== "tiktok") throw new Error("TikTok 계정만 지정할 수 있습니다.");
  return { username: source.id.toLowerCase(), url: source.url };
}
export function referenceAccounts(db: Database.Database) {
  return db.prepare("SELECT * FROM content_reference_accounts ORDER BY created_at,username").all() as Row[];
}
export function addReferenceAccount(db: Database.Database, raw: string) {
  const { username, url } = accountIdentity(raw);
  db.prepare("INSERT INTO content_reference_accounts(username,url,created_at) VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET enabled=1")
    .run(username, url, new Date().toISOString());
  publishChange({ kind: "library" });
}
export function externalReferences(db: Database.Database, query = "", type = "", includeExcluded = false) {
  const rows = db.prepare(`SELECT r.*,
    CASE WHEN view_count>0 AND like_count IS NOT NULL AND comment_count IS NOT NULL AND save_count IS NOT NULL
      THEN 1.0*(like_count+comment_count+save_count)/view_count END AS engagement_rate,
    COALESCE(v.slide_count,json_array_length(r.images_json)) AS slide_count
    FROM content_external_references r LEFT JOIN content_visual_sets v ON v.id=r.visual_set_id
    WHERE (? OR r.excluded=0) AND (r.caption LIKE ? OR r.title LIKE ? OR r.topic LIKE ? OR r.message LIKE ? OR r.content_type LIKE ?)
      AND (?='' OR r.content_type LIKE ? OR r.content_type='')
    ORDER BY engagement_rate DESC,r.published_at DESC,r.id`)
    .all(includeExcluded ? 1 : 0, ...Array(5).fill(`%${query}%`), type, `%${type}%`) as Row[];
  return rows.map(({images_json: images,...post}) => { void images; return post; });
}
export function setReferenceExcluded(db: Database.Database, id: string, excluded: boolean) {
  if (!db.prepare("UPDATE content_external_references SET excluded=? WHERE id=?").run(excluded ? 1 : 0, id).changes)
    throw new Error("외부 레퍼런스를 찾을 수 없습니다.");
  publishChange({ kind: "library" });
}
export function describeReference(db: Database.Database, id: string, description: ContentMetadata & { title: string }) {
  const metadata = readContentMetadata(description);
  if (!db.prepare("UPDATE content_external_references SET title=?,topic=?,content_type=?,message=? WHERE id=? AND excluded=0")
    .run(description.title, metadata.topic, metadata.content_type, metadata.message, id).changes)
    throw new Error("사용 가능한 외부 레퍼런스가 아닙니다.");
  publishChange({ kind: "library" });
}

export function removeReferenceAccount(db: Database.Database, username: string) {
  db.prepare("DELETE FROM content_reference_accounts WHERE username=?").run(username);
  publishChange({ kind: "library" });
}
