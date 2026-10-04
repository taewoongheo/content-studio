import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { POST as addPost, GET as listPosts } from "./route";
import { DELETE as removePost } from "./[postId]/route";
import type { PublishedPost } from "@/lib/local-db/published-posts";
import { getLocalDatabase } from "@/lib/local-db/database";

const origin = "http://localhost:3000";
const headers = { host: "localhost:3000", origin };

test("대시보드 API는 DB 기록을 추가·조회·삭제한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-api-test-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "studio.sqlite");
  try {
    const postResponse = await addPost(new Request(`${origin}/api/published-content`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "게시 완료", platform: "TikTok", publishedOn: "2026-09-26", url: "", notes: "" }),
    }));
    assert.equal(postResponse.status, 201);
    const post = await postResponse.json() as PublishedPost;
    assert.equal((await (await listPosts(new Request(`${origin}/api/published-content`, { headers }))).json())[0].id, post.id);
    assert.equal((await removePost(new Request(`${origin}/api/published-content/${post.id}`, { method: "DELETE", headers }), { params: Promise.resolve({ postId: post.id }) })).status, 204);
    assert.deepEqual(await (await listPosts(new Request(`${origin}/api/published-content`, { headers }))).json(), []);
  } finally {
    getLocalDatabase().close();
    delete process.env.CONTENT_STUDIO_DB_PATH;
    rmSync(directory, { recursive: true, force: true });
  }
});
