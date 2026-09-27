import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { AssetStore } from "./assets";
import { CharacterStore } from "./characters";
import { defaultDatabasePath, openLocalDatabase } from "./database";
import { PublishedPostStore } from "./published-posts";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("기본 DB는 프로젝트의 상위 workspace에 둔다", () => {
  if (process.env.CONTENT_STUDIO_DB_PATH) return;
  assert.equal(defaultDatabasePath(), join(dirname(realpathSync(process.cwd())), "content-studio.sqlite"));
});

test("이미지 원본과 메타데이터가 같은 DB에서 재시작 뒤에도 유지된다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-db-test-"));
  const path = join(directory, "studio.sqlite");
  try {
    const database = openLocalDatabase(path);
    const characters = new CharacterStore(database);
    const assets = new AssetStore(database);
    const character = characters.create({ description: "빨간 옷을 입은 인물", type: "image/png", bytes: pngHeader });
    const asset = assets.create({
      name: "운동 이미지", description: "정면에서 본 캐릭터",
      type: "image/png", bytes: pngHeader,
    });
    assert.deepEqual(assets.readImage(asset.id)?.bytes, Buffer.from(pngHeader));
    assert.equal("bytes" in assets.list()[0], false);
    assert.equal("data" in assets.list()[0], false);
    database.close();

    const reopened = openLocalDatabase(path);
    const savedAssets = new AssetStore(reopened);
    assert.equal(new CharacterStore(reopened).get(character.id)?.description, "빨간 옷을 입은 인물");
    assert.deepEqual(savedAssets.readImage(character.turnaroundAssetId!)?.bytes, Buffer.from(pngHeader));
    assert.equal(savedAssets.get(asset.id)?.description, "정면에서 본 캐릭터");
    assert.deepEqual(savedAssets.readImage(asset.id)?.bytes, Buffer.from(pngHeader));
    assert.equal(reopened.pragma("user_version", { simple: true }), 4);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("기존 DB를 게시 기록 스키마로 올리고 다시 열어도 기록을 유지한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-posts-test-"));
  const path = join(directory, "studio.sqlite");
  try {
    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE characters (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL, character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
        mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, data BLOB NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    legacy.pragma("user_version = 1");
    legacy.close();
    const database = openLocalDatabase(path);
    const posts = new PublishedPostStore(database);
    const post = posts.create({ title: "첫 게시물", platform: "TikTok", publishedOn: "2026-09-26", url: "https://example.com/post", notes: "메모" });
    assert.equal(posts.list()[0].id, post.id);
    database.close();
    const reopened = openLocalDatabase(path);
    assert.equal(new PublishedPostStore(reopened).list()[0].title, "첫 게시물");
    assert.equal(new PublishedPostStore(reopened).delete(post.id), true);
    assert.deepEqual(new PublishedPostStore(reopened).list(), []);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

test("캐릭터를 제거해도 턴어라운드 이미지가 남는다", () => {
  const database = openLocalDatabase(":memory:");
  try {
    const characters = new CharacterStore(database);
    const assets = new AssetStore(database);
    const character = characters.create({ description: "운동 캐릭터", type: "image/png", bytes: pngHeader });
    const asset = assets.create({ name: "이미지", type: "image/png", bytes: pngHeader });
    assert.throws(() => assets.delete(character.turnaroundAssetId!), /필수 턴어라운드/);
    characters.delete(character.id);
    assert.ok(assets.get(character.turnaroundAssetId!));
    assert.deepEqual(assets.readImage(asset.id)?.bytes, Buffer.from(pngHeader));
    assert.equal(assets.delete(character.turnaroundAssetId!), true);
  } finally {
    database.close();
  }
});

test("기존 캐릭터와 추가 참조 이미지의 원본을 보존하며 분류 컬럼을 제거한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-assets-migration-"));
  const path = join(directory, "studio.sqlite");
  try {
    const legacy = new Database(path);
    legacy.pragma("foreign_keys = OFF");
    legacy.exec(`
      CREATE TABLE characters (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        turnaround_asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE assets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        kind TEXT NOT NULL, character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
        mime_type TEXT NOT NULL, byte_size INTEGER NOT NULL, data BLOB NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX assets_character_id_idx ON assets(character_id);
      CREATE INDEX assets_created_at_idx ON assets(created_at DESC);
    `);
    for (const [id, name] of [["primary", "턴어라운드"], ["extra", "추가 이미지"]]) {
      legacy.prepare(`INSERT INTO assets (id, name, description, kind, character_id, mime_type, byte_size, data, created_at, updated_at)
        VALUES (?, ?, '', 'character_reference', 'character', 'image/png', ?, ?, '', '')`)
        .run(id, name, pngHeader.byteLength, Buffer.from(pngHeader));
    }
    legacy.prepare(`INSERT INTO characters (id, name, description, turnaround_asset_id, created_at, updated_at)
      VALUES ('character', '', '빨간 옷', 'primary', '', '')`).run();
    legacy.pragma("user_version = 3");
    legacy.close();

    const migrated = openLocalDatabase(path);
    const assets = new AssetStore(migrated);
    assert.equal(new CharacterStore(migrated).get("character")?.turnaroundAssetId, "primary");
    assert.deepEqual(assets.readImage("primary")?.bytes, Buffer.from(pngHeader));
    assert.deepEqual(assets.readImage("extra")?.bytes, Buffer.from(pngHeader));
    assert.deepEqual(assets.list().map(({ id }) => id).sort(), ["extra", "primary"]);
    const columns = migrated.pragma("table_info(assets)") as Array<{ name: string }>;
    assert.equal(columns.some(({ name }) => name === "kind" || name === "character_id"), false);
    assert.deepEqual(migrated.pragma("foreign_key_check"), []);
    assert.equal(migrated.pragma("user_version", { simple: true }), 4);
    migrated.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("캐릭터 설명과 턴어라운드는 모두 필수이며 실패 시 에셋도 생성하지 않는다", () => {
  const database = openLocalDatabase(":memory:");
  try {
    const characters = new CharacterStore(database);
    const assets = new AssetStore(database);
    assert.throws(() => characters.create({ description: "", type: "image/png", bytes: pngHeader }), /설명과 턴어라운드/);
    assert.throws(() => characters.create({ description: "설명", type: "image/png", bytes: new Uint8Array() }), /설명과 턴어라운드/);
    assert.deepEqual(characters.list(), []);
    assert.deepEqual(assets.list(), []);
  } finally { database.close(); }
});
