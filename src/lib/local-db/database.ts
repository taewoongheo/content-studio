import Database from "better-sqlite3";
import { mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

const SCHEMA_VERSION = 4;

export function defaultDatabasePath() {
  if (process.env.CONTENT_STUDIO_DB_PATH) return process.env.CONTENT_STUDIO_DB_PATH;
  return join(dirname(realpathSync(process.cwd())), "content-studio.sqlite");
}

export function openLocalDatabase(path = defaultDatabasePath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  try {
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    let version = database.pragma("user_version", { simple: true }) as number;
    if (version > SCHEMA_VERSION)
      throw new Error(`지원하지 않는 Content Studio DB 버전입니다: ${version}`);
    if (version < 1) {
      database.transaction(() => {
        database.exec(`
          CREATE TABLE characters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            turnaround_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE assets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
            byte_size INTEGER NOT NULL CHECK (byte_size > 0),
            data BLOB NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX assets_created_at_idx ON assets(created_at DESC);
          CREATE TABLE published_posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            platform TEXT NOT NULL,
            published_on TEXT NOT NULL,
            url TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
          );
          CREATE INDEX published_posts_date_idx ON published_posts(published_on DESC);
        `);
        database.pragma("user_version = 4");
      })();
      version = 4;
    }
    if (version < 2) {
      database.transaction(() => {
        database.exec(`
          CREATE TABLE published_posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            platform TEXT NOT NULL,
            published_on TEXT NOT NULL,
            url TEXT NOT NULL DEFAULT '',
            notes TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
          );
          CREATE INDEX published_posts_date_idx ON published_posts(published_on DESC);
        `);
        database.pragma("user_version = 2");
      })();
    }
    if (version < 3) {
      database.transaction(() => {
        database.exec("ALTER TABLE characters ADD COLUMN turnaround_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT");
        database.pragma("user_version = 3");
      })();
    }
    if (version < 4) {
      database.pragma("foreign_keys = OFF");
      try {
        database.transaction(() => {
          database.exec(`
            CREATE TABLE assets_next (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT NOT NULL DEFAULT '',
              mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
              byte_size INTEGER NOT NULL CHECK (byte_size > 0),
              data BLOB NOT NULL,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            INSERT INTO assets_next (id, name, description, mime_type, byte_size, data, created_at, updated_at)
              SELECT id, name, description, mime_type, byte_size, data, created_at, updated_at FROM assets;
            DROP TABLE assets;
            ALTER TABLE assets_next RENAME TO assets;
            CREATE INDEX assets_created_at_idx ON assets(created_at DESC);
          `);
          if ((database.pragma("foreign_key_check") as unknown[]).length > 0)
            throw new Error("이미지 DB의 참조 관계를 확인해 주세요.");
          database.pragma("user_version = 4");
        })();
      } finally {
        database.pragma("foreign_keys = ON");
      }
    }
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
