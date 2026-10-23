import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GET as listPosts } from "./route";
import { PATCH as metadata } from "../content-projects/[projectId]/metadata/route";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { getLocalDatabase } from "@/lib/local-db/database";

test("게시 달력은 URL과 실제 게시 시각을 가진 로그만 조회한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-api-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "studio.sqlite");
  const origin = "http://localhost:3000", headers = { host: "localhost:3000", origin };
  try {
    const db = getLocalDatabase(), store = new ContentProjectStore(db);
    store.save({ id: "post", name: "게시 완료", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
    const context = { params: Promise.resolve({ projectId: "post" }) };
    const request = (value: unknown, requestOrigin = origin) => new Request(`${origin}/api/content-projects/post/metadata`, {
      method: "PATCH", headers: { ...headers, origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(value),
    });
    assert.equal((await metadata(request({topic:"등",message:"선택 기준"},"https://evil.example"),context)).status,403);
    assert.equal((await metadata(request({topic:"등",message:"선택 기준",templateId:"old"}),context)).status,400);
    assert.equal((await metadata(request({topic:"등",message:"선택 기준"}),context)).status,200);
    const list = async () => (await listPosts(new Request(`${origin}/api/published-content`, {headers}))).json();
    assert.deepEqual(await list(), []);
    db.prepare(`INSERT INTO content_creation_logs(id,project_id,created_at,updated_at) VALUES('log','post','now','now')`).run();
    assert.deepEqual(await list(), []);
    db.prepare(`UPDATE content_creation_logs SET post_url='https://www.tiktok.com/@a/photo/123',actual_published_at='2026-10-22T16:00:00Z' WHERE id='log'`).run();
    const posts = await list();
    assert.equal(posts[0].id,"post");
    assert.equal(posts[0].publishedOn,"2026-10-23");
    assert.equal(posts[0].postUrl,"https://www.tiktok.com/@a/photo/123");
    store.delete("post");
    assert.deepEqual(await list(), []);
  } finally {
    getLocalDatabase().close(); delete process.env.CONTENT_STUDIO_DB_PATH;
    rmSync(directory, { recursive:true, force:true });
  }
});
