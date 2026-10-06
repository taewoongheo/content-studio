import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { defaultDatabasePath, openLocalDatabase } from "./database";
import { PublishedPostStore } from "./published-posts";

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

test("DB를 다시 열어도 게시 기록이 유지되고 공용 라이브러리 테이블을 만들지 않는다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-db-test-"));
  const path = join(directory, "studio.sqlite");
  try {
    const database = openLocalDatabase(path);
    const post = new PublishedPostStore(database).create({ title: "게시물", platform: "TikTok", publishedOn: "2026-10-04", url: "", notes: "" });
    database.close();
    const reopened = openLocalDatabase(path);
    assert.equal(new PublishedPostStore(reopened).list()[0].id, post.id);
    assert.deepEqual(reopened.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all(), [{ name: "published_posts" }]);
    reopened.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("게시 날짜와 외부 링크를 검증한다", () => {
  const database = openLocalDatabase(":memory:");
  try {
    const posts = new PublishedPostStore(database);
    const valid = { title: "게시물", platform: "TikTok", publishedOn: "2026-02-28", url: "", notes: "" };
    assert.throws(() => posts.create({ ...valid, publishedOn: "2026-02-30" }), /날짜/);
    assert.throws(() => posts.create({ ...valid, url: "javascript:alert(1)" }), /링크/);
    assert.deepEqual(posts.list(), []);
  } finally {
    database.close();
  }
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
