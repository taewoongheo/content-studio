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
export function externalReferences(db: Database.Database, query = "", type = "") {
  const rows = db.prepare(`SELECT r.id,r.url,r.account,r.caption,r.title,r.topic,r.content_type,r.message,
    r.published_at,r.observed_at,r.visual_set_id,r.image_error,r.created_at,r.last_selected_at,
    COALESCE(v.slide_count,json_array_length(r.images_json)) AS slide_count
    FROM content_external_references r LEFT JOIN content_visual_sets v ON v.id=r.visual_set_id
    WHERE (r.caption LIKE ? OR r.title LIKE ? OR r.topic LIKE ? OR r.message LIKE ? OR r.content_type LIKE ?)
      AND (?='' OR r.content_type LIKE ? OR r.content_type='')
    ORDER BY r.published_at DESC,r.id`)
    .all(...Array(5).fill(`%${query}%`), type, `%${type}%`) as Row[];
  return rows;
}
export function describeReference(db: Database.Database, id: string, description: ContentMetadata & { title: string }) {
  const metadata = readContentMetadata(description);
  if (!db.prepare("UPDATE content_external_references SET title=?,topic=?,content_type=?,message=? WHERE id=?")
    .run(description.title, metadata.topic, metadata.content_type, metadata.message, id).changes)
    throw new Error("사용 가능한 외부 레퍼런스가 아닙니다.");
  publishChange({ kind: "library" });
}

export function removeReferenceAccount(db: Database.Database, username: string) {
  db.prepare("DELETE FROM content_reference_accounts WHERE username=?").run(username);
  publishChange({ kind: "library" });
}
