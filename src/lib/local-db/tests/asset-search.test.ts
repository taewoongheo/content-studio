import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLocalDatabase } from "../database";
import { AssetStore } from "../assets";

test("에셋 검색은 메타데이터만 반환하며 검색어 매칭·제한·와일드카드 escaping을 적용한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-search-"));
  const db = openLocalDatabase(join(directory, "test.sqlite"));
  try {
    const store = new AssetStore(db);
    store.create({ name: "squat", description: "스쿼트 전면", type: "image/png", bytes: new Uint8Array([1]) });
    store.create({ name: "press", description: "벤치 프레스", type: "image/png", bytes: new Uint8Array([1]) });
    const percent = store.create({ name: "100%", type: "image/png", bytes: new Uint8Array([1]) });
    assert.equal(store.search("squat 스쿼트")[0].name, "squat");
    assert.equal(store.search("squat press", 1).length, 1);
    assert.deepEqual(store.search("%" ).map((asset) => asset.id), [percent.id]);
    assert.deepEqual(store.search(""), []);
    assert.equal("bytes" in store.search("squat")[0], false);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
