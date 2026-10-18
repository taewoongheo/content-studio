import assert from "node:assert/strict";
import test from "node:test";
import { createLayer, newVideoDocument, type VideoSnapshot } from "@/domains/video/domain/model";
import { inspectVideo } from "./inspection";
test("영상 부분 조회는 선택한 요소만 반환하고 기본 전체 조회는 이전 응답을 유지한다", () => {
  const document = newVideoDocument(); document.layers = [createLayer("text", document), createLayer("shape", document)];
  const snapshot: VideoSnapshot = { id: crypto.randomUUID(), tabId: crypto.randomUUID(), name: "video", revision: 7, document, assets: [], canUndo: true, canRedo: false };
  assert.deepEqual(inspectVideo(snapshot), snapshot);
  const selected = inspectVideo(snapshot, { layerIds: [document.layers[0].id], includeAssets: false });
  assert.ok("document" in selected && selected.document); assert.equal(selected.document.layers.length, 1);
  assert.equal(selected.partial, true); assert.equal(selected.revision, 7);
  const outline = inspectVideo(snapshot, { outline: true }); assert.ok("layers" in outline && outline.layers);
  assert.equal(outline.layers.length, 2); assert.equal("document" in outline, false);
  assert.throws(() => inspectVideo(snapshot, { layerIds: [crypto.randomUUID()] })); assert.equal(document.layers.length, 2);
});
