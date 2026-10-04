import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { defaultDatabasePath, openLocalDatabase } from "./database";
import { PublishedPostStore } from "./published-posts";

test("기본 DB는 프로젝트의 상위 workspace에 둔다", () => {
  if (process.env.CONTENT_STUDIO_DB_PATH) return;
  assert.equal(defaultDatabasePath(), join(dirname(realpathSync(process.cwd())), "content-studio.sqlite"));
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
