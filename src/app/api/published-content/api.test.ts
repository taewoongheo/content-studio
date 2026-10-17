import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GET as listPosts } from "./route";
import { DELETE as removePost } from "./[postId]/route";
import type { PublishedPost } from "@/domains/slideshow/projects/published-posts";
import { POST as publish } from "../content-projects/[projectId]/publication/route";
import { PATCH as metadata } from "../content-projects/[projectId]/metadata/route";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { getLocalDatabase } from "@/lib/local-db/database";

const origin = "http://localhost:3000";
const headers = { host: "localhost:3000", origin };

test("대시보드 API는 DB 기록을 추가·조회·삭제한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-api-test-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "studio.sqlite");
  try {
    const store = new ContentProjectStore(getLocalDatabase());
    store.save({ id: "post", name: "게시 완료", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
    const context = { params: Promise.resolve({ projectId: "post" }) };
    const url = `${origin}/api/content-projects/post/publication`;
    assert.equal((await publish(new Request(url, { method: "POST", headers: { ...headers, origin: "https://evil.example" } }), context)).status, 403);
    assert.equal((await publish(new Request(url, { method: "POST", headers }), context)).status, 422);
    assert.equal((await metadata(new Request(`${origin}/api/content-projects/post/metadata`, { method: "PATCH", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ topic: "등", message: "등 운동을 선택하는 방법" }) }), context)).status, 200);
    const postResponse = await publish(new Request(url, { method: "POST", headers }), context);
    assert.equal(postResponse.status, 200);
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
