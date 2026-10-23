import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SCHEMA_VERSION, defaultDatabasePath, openLocalDatabase } from "./database";
import { listPublishedPosts } from "@/domains/content-production/server/publication/list";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";

test("DB 경로는 실행 폴더가 바뀌어도 고정되며 상대 경로 설정은 거부한다", () => {
  const originalDirectory = process.cwd(), originalPath = process.env.CONTENT_STUDIO_DB_PATH;
  try {
    delete process.env.CONTENT_STUDIO_DB_PATH;
    process.chdir(tmpdir());
    assert.equal(defaultDatabasePath(), "/Users/taewoongheo/Projects/content-studio-workspace/content-studio.sqlite");
    process.env.CONTENT_STUDIO_DB_PATH = "different.sqlite";
    assert.throws(defaultDatabasePath, /절대 경로/);
    process.env.CONTENT_STUDIO_DB_PATH = join(tmpdir(), "isolated-test.sqlite");
    assert.equal(defaultDatabasePath(), join(tmpdir(), "isolated-test.sqlite"));
  } finally {
    process.chdir(originalDirectory);
    if (originalPath === undefined) delete process.env.CONTENT_STUDIO_DB_PATH;
    else process.env.CONTENT_STUDIO_DB_PATH = originalPath;
  }
});

test("DB 재연결 후 URL 기반 게시 기록과 현재 테이블 구조가 유지된다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-db-test-"));
  const path = join(directory, "studio.sqlite");
  try {
    const database = openLocalDatabase(path);
    const store = new ContentProjectStore(database);
    store.save({ id: "post", name: "게시물", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
    store.updateMetadata("post", { topic: "Back training", message: "Choose back exercises with less lower-back strain" });
    const publishedAt = "2026-10-23T00:00:00Z";
    database.prepare(`INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,created_at,updated_at)
      VALUES('log','post','https://www.tiktok.com/@a/photo/123',?,?,?)`).run(publishedAt,publishedAt,publishedAt);
    database.close();
    const reopened = openLocalDatabase(path);
    assert.equal(listPublishedPosts(reopened)[0].publishedAt, publishedAt);
    assert.deepEqual((reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{name:string}>).map(row => row.name), ["content_analysis_drafts", "content_creation_logs", "content_drafts", "content_production_drafts", "content_project_assets", "content_projects", "content_references", "content_visual_sets", "content_visual_slides", "video_project_assets", "video_projects"]);
    reopened.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("지원하지 않는 프로젝트 스키마는 데이터와 버전을 변경하지 않고 거부한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-unsupported-db-"));
  try {
    for (const [index, columns, version] of [
      [0, "", 4],
      [1, ", composition TEXT NOT NULL DEFAULT ''", 4],
      [2, ", is_template INTEGER NOT NULL DEFAULT 0", 7],
    ] as const) {
      const path = join(directory, `${index}.sqlite`);
      const legacy = new Database(path);
      legacy.exec(`CREATE TABLE content_projects (id TEXT PRIMARY KEY, document_json TEXT NOT NULL${columns});
        INSERT INTO content_projects (id, document_json) VALUES ('saved', '{"slides":["original"]}');`);
      legacy.pragma(`user_version = ${version}`);
      const originalRows = legacy.prepare("SELECT * FROM content_projects").all();
      const originalSchema = legacy.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all();
      legacy.close();
      assert.throws(() => openLocalDatabase(path), /지원하지 않는 프로젝트 DB 스키마/);
      const unchanged = new Database(path);
      try {
        assert.equal(unchanged.pragma("user_version", { simple: true }), version);
        assert.deepEqual(unchanged.prepare("SELECT * FROM content_projects").all(), originalRows);
        assert.deepEqual(unchanged.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all(), originalSchema);
      } finally { unchanged.close(); }
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("이전 버전 DB는 자동 변환 없이 거부한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-old-db-"));
  const path = join(directory, "legacy.sqlite");
  try {
    const db = openLocalDatabase(path);
    db.pragma(`user_version = ${SCHEMA_VERSION - 1}`);
    db.close();
    assert.throws(() => openLocalDatabase(path), /지원하지 않는 프로젝트 DB 스키마/);
    const unchanged = new Database(path);
    assert.equal(unchanged.pragma("user_version", { simple: true }), SCHEMA_VERSION - 1);
    unchanged.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
