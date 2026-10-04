import Database from "better-sqlite3";
import { mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA_VERSION = 7;

export function defaultDatabasePath() {
  if (process.env.CONTENT_STUDIO_DB_PATH) return process.env.CONTENT_STUDIO_DB_PATH;
  return join(dirname(realpathSync(process.cwd())), "content-studio.sqlite");
}

export function openLocalDatabase(path = defaultDatabasePath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  try {
    database.pragma("foreign_keys = ON");
    const version = database.pragma("user_version", { simple: true }) as number;
    if (version > SCHEMA_VERSION)
      throw new Error(`지원하지 않는 Content Studio DB 버전입니다: ${version}`);
    const projectColumns = database.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>;
    const missingColumns = ["composition", "is_template"].filter(name => !projectColumns.some(column => column.name === name));
    if (projectColumns.length && missingColumns.length)
      throw new Error(`지원하지 않는 프로젝트 DB 스키마입니다 (${missingColumns.join(", ")} 누락). 자동 마이그레이션은 제공하지 않습니다. 기존 DB를 백업한 후 현재 스키마로 준비해 주세요.`);
    database.pragma("journal_mode = WAL");
    database.transaction(() => {
      database.exec(`
      CREATE TABLE IF NOT EXISTS published_posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        platform TEXT NOT NULL,
        published_on TEXT NOT NULL,
        url TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS published_posts_date_idx ON published_posts(published_on DESC);
      `);
      database.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}

const globalDatabase = globalThis as typeof globalThis & {
  contentStudioLocalDatabase?: { path: string; version?: number; database: Database.Database };
};

export function getLocalDatabase() {
  const path = defaultDatabasePath();
  const retained = globalDatabase.contentStudioLocalDatabase;
  if (retained?.path === path && retained.version === SCHEMA_VERSION && retained.database.open)
    return retained.database;
  if (retained?.database.open) retained.database.close();
  const database = openLocalDatabase(path);
  globalDatabase.contentStudioLocalDatabase = { path, version: SCHEMA_VERSION, database };
  return database;
}
