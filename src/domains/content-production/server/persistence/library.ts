import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { referenceSchema, type Row } from "../../domain/contracts";
import { decode } from "./store";
import {
  ApifyTikTokClient,
  normalizeTikTokUrl,
} from "@/domains/research/server/apify/client";
import { collectVisuals, saveVisuals } from "../publication/visuals";
import { publishChange } from "../events";
export function references(db: Database.Database, query = "") {
  return (
    db
      .prepare(
        "SELECT * FROM content_references WHERE title LIKE ? OR topic LIKE ? ORDER BY created_at DESC",
      )
      .all(`%${query}%`, `%${query}%`) as Row[]
  ).map(decode);
}
export async function addReference(db: Database.Database, raw: unknown) {
  const input = referenceSchema.parse(raw),
    id = randomUUID(),
    now = new Date().toISOString();
  if (input.source_url && (input.project_id || input.log_id))
    throw new Error("자체 콘텐츠와 외부 URL 중 하나만 지정해 주세요.");
  if (input.log_id && input.project_id) {
    const log = db
      .prepare("SELECT project_id FROM content_creation_logs WHERE id=?")
      .get(input.log_id) as Row | undefined;
    if (log?.project_id !== input.project_id)
      throw new Error("프로젝트와 로그가 일치하지 않습니다.");
  }
  let source: string | null = null,
    visual: string | null = null;
  if (input.source_url) {
    source = normalizeTikTokUrl(input.source_url).url;
    const existing = db
      .prepare("SELECT id FROM content_references WHERE source_url=?")
      .get(source);
    if (existing) throw new Error("이미 등록한 레퍼런스입니다.");
    const [post] = await new ApifyTikTokClient().posts([source]);
    visual = saveVisuals(db, {
      kind: "reference",
      url: source,
      slides: await collectVisuals(post.images),
    });
  }
  db.prepare(
    "INSERT INTO content_references VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    source ? "external" : "own",
    input.title,
    input.topic,
    input.content_type,
    input.project_id ?? null,
    input.log_id ?? null,
    source,
    visual,
    JSON.stringify(input.parts),
    now,
    now,
  );
  publishChange({ kind: "library" });
  return { id };
}
export async function captureReference(db: Database.Database, url: string) {
  const source = normalizeTikTokUrl(url).url;
  const [post] = await new ApifyTikTokClient().posts([source]);
  const set_id = saveVisuals(db, {
    kind: "reference",
    url: source,
    slides: await collectVisuals(post.images),
  });
  return { ...post, set_id };
}
