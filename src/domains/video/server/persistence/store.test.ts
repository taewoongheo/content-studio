import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { VideoStore } from "@/domains/video/server/persistence/store";
import { createLayer, newVideoDocument, type VideoLayer, videoDocumentSchema } from "@/domains/video/domain/model";
test("영상 문서·미디어 복제는 독립적이며 삭제는 자신의 자산만 제거한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const store = new VideoStore(db), doc = newVideoDocument(); store.save("original", "운동 영상", doc, 0);
    const asset = store.addAsset("original", "exercise.mp4", "video/mp4", Buffer.from("video bytes"));
    const l: VideoLayer = { ...createLayer("shape", doc), kind: "video", assetId: asset.id, sourceFrames: 300, trimStart: 0, trimEnd: 300, volume: 0, loop: true, fit: "contain", cropX: 50, cropY: 50 };
    doc.layers.push(l); store.save("original", "운동 영상", doc, 1);
    const copy = store.clone("original");
    assert.deepEqual(store.get(copy)?.document, videoDocumentSchema.parse(doc)); assert.deepEqual(store.asset(copy, asset.id)?.data, Buffer.from("video bytes"));
    store.rename(copy, "복사본"); store.delete("original");
    assert.equal(store.get("original"), null); assert.equal(store.assets("original").length, 0);
    assert.equal(store.get(copy)?.name, "복사본"); assert.equal(store.assets(copy).length, 1);
    assert.throws(() => store.save(copy, "복사본", { ...doc, layers: [{ ...l, assetId: crypto.randomUUID() }] }, 2), /미디어/);
    assert.equal(store.get(copy)?.revision, 0, "저장 실패 시 기존 문서를 유지한다");
    store.delete(copy); assert.equal(store.list().length, 0);
  } finally { db.close(); }
});
