import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GET as listLibrary } from "./route";
import { POST as addCharacter } from "./characters/route";
import { DELETE as removeCharacter } from "./characters/[characterId]/route";
import { POST as addAsset } from "./assets/route";
import { DELETE as removeAsset, GET as readAsset } from "./assets/[assetId]/route";
import { POST as addPost, GET as listPosts } from "../published-content/route";
import { DELETE as removePost } from "../published-content/[postId]/route";
import type { StoredAsset } from "@/lib/local-db/assets";
import type { StoredCharacter } from "@/lib/local-db/characters";
import type { PublishedPost } from "@/lib/local-db/published-posts";
import { getLocalDatabase } from "@/lib/local-db/database";

const origin = "http://localhost:3000";
const headers = { host: "localhost:3000", origin };
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("대시보드 API는 DB 기록을 추가·조회·삭제한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-api-test-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "studio.sqlite");
  try {
    const characterForm = new FormData();
    characterForm.set("description", "빨간 옷");
    characterForm.set("image", new File([png], "turnaround.png", { type: "image/png" }));
    const characterResponse = await addCharacter(new Request(`${origin}/api/library/characters`, {
      method: "POST", headers, body: characterForm,
    }));
    assert.equal(characterResponse.status, 201);
    const character = await characterResponse.json() as StoredCharacter;
    assert.ok(character.turnaroundAssetId);
    assert.equal(character.description, "빨간 옷");
    const missingImage = new FormData();
    missingImage.set("description", "이미지 없음");
    assert.equal((await addCharacter(new Request(`${origin}/api/library/characters`, { method: "POST", headers, body: missingImage }))).status, 400);
    const missingDescription = new FormData();
    missingDescription.set("image", new File([png], "turnaround.png", { type: "image/png" }));
    assert.equal((await addCharacter(new Request(`${origin}/api/library/characters`, { method: "POST", headers, body: missingDescription }))).status, 400);
    assert.equal((await removeAsset(new Request(`${origin}/api/library/assets/${character.turnaroundAssetId}`, { method: "DELETE", headers }), { params: Promise.resolve({ assetId: character.turnaroundAssetId! }) })).status, 409);

    const form = new FormData();
    form.set("image", new File([png], "front.png", { type: "image/png" }));
    form.set("name", "정면"); form.set("description", "캐릭터 정면");
    const assetResponse = await addAsset(new Request(`${origin}/api/library/assets`, { method: "POST", headers, body: form }));
    assert.equal(assetResponse.status, 201);
    const asset = await assetResponse.json() as StoredAsset;
    assert.equal("kind" in asset, false);
    assert.equal("characterId" in asset, false);
    const library = await (await listLibrary(new Request(`${origin}/api/library`, { headers }))).json();
    assert.equal(library.assets[0].description, "캐릭터 정면");
    assert.equal(library.characters[0].id, character.id);
    const image = await readAsset(new Request(`${origin}/api/library/assets/${asset.id}`, { headers }), { params: Promise.resolve({ assetId: asset.id }) });
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), png);

    const postResponse = await addPost(new Request(`${origin}/api/published-content`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ title: "게시 완료", platform: "TikTok", publishedOn: "2026-09-26", url: "", notes: "" }),
    }));
    assert.equal(postResponse.status, 201);
    const post = await postResponse.json() as PublishedPost;
    assert.equal((await (await listPosts(new Request(`${origin}/api/published-content`, { headers }))).json())[0].id, post.id);
    assert.equal((await removePost(new Request(`${origin}/api/published-content/${post.id}`, { method: "DELETE", headers }), { params: Promise.resolve({ postId: post.id }) })).status, 204);
    assert.deepEqual(await (await listPosts(new Request(`${origin}/api/published-content`, { headers }))).json(), []);
    assert.equal((await removeAsset(new Request(`${origin}/api/library/assets/${asset.id}`, { method: "DELETE", headers }), { params: Promise.resolve({ assetId: asset.id }) })).status, 204);
    assert.equal((await removeCharacter(new Request(`${origin}/api/library/characters/${character.id}`, { method: "DELETE", headers }), { params: Promise.resolve({ characterId: character.id }) })).status, 204);
    const empty = await (await listLibrary(new Request(`${origin}/api/library`, { headers }))).json();
    assert.equal(empty.assets.length, 1); assert.deepEqual(empty.characters, []);
  } finally {
    getLocalDatabase().close();
    delete process.env.CONTENT_STUDIO_DB_PATH;
    rmSync(directory, { recursive: true, force: true });
  }
});
