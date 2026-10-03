import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type PublishedPostInput = {
  title: string;
  platform: string;
  publishedOn: string;
  url: string;
  notes: string;
};

export type PublishedPost = PublishedPostInput & {
  id: string;
  createdAt: string;
};

type PostRow = {
  id: string;
  title: string;
  platform: string;
  published_on: string;
  url: string;
  notes: string;
  created_at: string;
};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parsePublishedPostInput(value: unknown): PublishedPostInput {
  if (typeof value !== "object" || value === null) throw new Error("게시 기록을 확인해 주세요.");
  const input = value as Record<string, unknown>;
  if (typeof input.title !== "string" || !input.title.trim() || input.title.length > 160)
    throw new Error("제목은 1~160자로 입력해 주세요.");
  if (typeof input.platform !== "string" || !input.platform.trim() || input.platform.length > 40)
    throw new Error("게시 플랫폼을 입력해 주세요.");
  if (typeof input.publishedOn !== "string" || !isValidDate(input.publishedOn))
    throw new Error("게시 날짜를 확인해 주세요.");
  if (typeof input.url !== "string" || input.url.length > 2000)
    throw new Error("게시물 링크를 확인해 주세요.");
  if (input.url.trim()) {
    let url: URL;
    try { url = new URL(input.url.trim()); } catch { throw new Error("올바른 게시물 링크를 입력해 주세요."); }
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("http 또는 https 링크만 사용할 수 있습니다.");
  }
  if (typeof input.notes !== "string" || input.notes.length > 4000)
    throw new Error("메모는 4000자 이하로 입력해 주세요.");
  return {
    title: input.title.trim(), platform: input.platform.trim(), publishedOn: input.publishedOn,
    url: input.url.trim(), notes: input.notes.trim(),
  };
}

function toPost(row: PostRow): PublishedPost {
  return {
    id: row.id, title: row.title, platform: row.platform, publishedOn: row.published_on,
    url: row.url, notes: row.notes, createdAt: row.created_at,
  };
}

export class PublishedPostStore {
  constructor(private readonly database: Database.Database) {}

  create(value: unknown) {
    const input = parsePublishedPostInput(value);
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO published_posts (id, title, platform, published_on, url, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.title, input.platform, input.publishedOn, input.url, input.notes, createdAt);
    return { id, ...input, createdAt };
  }

  list() {
    const rows = this.database.prepare("SELECT * FROM published_posts ORDER BY published_on DESC, created_at DESC")
      .all() as PostRow[];
    return rows.map(toPost);
  }

  delete(id: string) {
    return this.database.prepare("DELETE FROM published_posts WHERE id = ?").run(id).changes > 0;
  }
}
