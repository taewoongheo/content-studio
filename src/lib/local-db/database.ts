import { PRODUCTION_SCHEMA } from "@/domains/content-production/server/persistence/schema";
import { VIDEO_SCHEMA } from "@/domains/video/server/persistence/schema";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { PROJECT_SCHEMA } from "@/domains/slideshow/server/persistence/projects/schema";

export const SCHEMA_VERSION = 16;

export function defaultDatabasePath() {
  const override = process.env.CONTENT_STUDIO_DB_PATH;
  if (override) {
    if (override !== ":memory:" && !isAbsolute(override)) throw new Error("CONTENT_STUDIO_DB_PATH는 절대 경로여야 합니다.");
    return override;
  }
  return "/Users/taewoongheo/Projects/content-studio-workspace/content-studio.sqlite";
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
    const missingColumns = ["topic", "message", "document_json"].filter(name => !projectColumns.some(column => column.name === name));
    if (projectColumns.length && (version !== SCHEMA_VERSION || missingColumns.length))
      throw new Error("지원하지 않는 프로젝트 DB 스키마입니다. 서버를 종료하고 DB를 확인해 주세요. 자동 변환은 제공하지 않습니다.");
    database.pragma("journal_mode = WAL");
    database.transaction(() => {
      database.exec(PROJECT_SCHEMA);
      database.exec(VIDEO_SCHEMA);
      database.exec(PRODUCTION_SCHEMA);
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
