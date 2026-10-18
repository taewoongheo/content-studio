import assert from "node:assert/strict";
import test from "node:test";
import { createLayer, newVideoDocument, splitVideoLayer, videoDocumentSchema, videoDuration, type VideoLayer } from "@/domains/video/domain/model";
test("독립 영상 여러 개가 겹쳐도 순서대로 합산하지 않고 마지막 종료 시점으로 길이를 계산한다", () => {
  const doc = newVideoDocument(); doc.duration = 1;
  const shape = createLayer("shape", doc);
  doc.layers = [{ ...shape, duration: 90 }, { ...shape, id: crypto.randomUUID(), from: 30, duration: 120 }];
  assert.equal(videoDuration(doc), 150);
  assert.equal(videoDocumentSchema.safeParse(doc).success, true);
});
test("영상 분할은 원본 자르기 구간과 시작 시점을 함께 나누고 반복 영상은 거부한다", () => {
  const video: VideoLayer = { ...createLayer("shape", newVideoDocument()), kind: "video", assetId: crypto.randomUUID(), from: 20, duration: 90, sourceFrames: 180, trimStart: 30, trimEnd: 120, volume: 0.5, loop: false, fit: "contain", cropX: 50, cropY: 50 };
  const pair = splitVideoLayer(video, 50)!;
  assert.equal(pair[0].duration, 30); assert.equal(pair[1].from, 50); assert.equal(pair[1].duration, 60);
  assert.equal(pair[0].kind === "video" && pair[0].trimEnd, 60);
  assert.equal(pair[1].kind === "video" && pair[1].trimStart, 60);
  assert.equal(splitVideoLayer({ ...video, loop: true }, 50), null);
  assert.equal(splitVideoLayer(video, 20), null);
});
test("잘못된 원본 구간, 중복 ID, 홀수 해상도, 외부 소스는 저장 모델에 들어오지 않는다", () => {
  const doc = newVideoDocument(), shape = createLayer("shape", doc);
  assert.equal(videoDocumentSchema.safeParse({ ...doc, width: 1081 }).success, false);
  assert.equal(videoDocumentSchema.safeParse({ ...doc, layers: [shape, shape] }).success, false);
  const video = { ...shape, kind: "video", assetId: crypto.randomUUID(), sourceFrames: 100, trimStart: 20, trimEnd: 80, duration: 90, volume: 1, loop: false, fit: "cover", cropX: 50, cropY: 50 };
  assert.equal(videoDocumentSchema.safeParse({ ...doc, layers: [video] }).success, false);
  assert.equal(videoDocumentSchema.safeParse({ ...doc, layers: [{ ...video, loop: true }] }).success, true);
});
test("연결 클립은 자르기·재정렬 후 이어지고 독립 요소의 시점은 유지된다", async () => {
  const { reflowSequence } = await import("@/domains/video/domain/model");
  const doc = newVideoDocument(), base = createLayer("shape", doc);
  const first: VideoLayer = { ...base, kind: "video", assetId: crypto.randomUUID(), sourceFrames: 300, trimStart: 0, trimEnd: 90, duration: 90, volume: 1, loop: false, sequence: true, fit: "cover", cropX: 50, cropY: 50 };
  const second = { ...first, id: crypto.randomUUID(), from: 90, duration: 60, trimEnd: 60 };
  const overlay = { ...first, id: crypto.randomUUID(), from: 15, sequence: false };
  const result = reflowSequence({ ...doc, layers: [second, overlay, { ...first, duration: 30, trimEnd: 30 }] });
  assert.deepEqual(result.layers.map(l => l.from), [0, 15, 60]);
});
test("레이어를 드래그해도 연결 영상의 재생 시점과 순서를 유지한다", async () => {
  const { reflowSequence, reorderVideoLayers } = await import("@/domains/video/domain/model");
  const doc = newVideoDocument(), base = createLayer("shape", doc);
  const first: VideoLayer = { ...base, kind: "video", assetId: crypto.randomUUID(), sourceFrames: 300, trimStart: 0, trimEnd: 90, duration: 90, volume: 1, loop: false, sequence: true, fit: "cover", cropX: 50, cropY: 50 };
  const second = { ...first, id: crypto.randomUUID(), from: 90, duration: 60, trimEnd: 60 };
  const normalized = reflowSequence({ ...doc, layers: [first, second] });
  const reordered = reflowSequence(reorderVideoLayers(normalized, second.id, first.id));
  assert.deepEqual(reordered.layers.map(l => l.id), [second.id, first.id]);
  assert.deepEqual(reordered.layers.map(l => l.from), [90, 0]);
  const split = splitVideoLayer(reordered.layers[1], 30)!;
  const withSplit = reflowSequence({ ...doc, layers: [reordered.layers[0], ...split] });
  assert.equal(withSplit.layers.find(l => l.id === second.id)?.from, 90);
});
test("이어붙이기는 영상뿐 아니라 오디오·텍스트의 마지막 끝을 보존한다", async () => {
  const { appendFrame, reflowSequence } = await import("@/domains/video/domain/model");
  const doc = newVideoDocument();
  assert.equal(appendFrame(doc), 0, "빈 프로젝트는 0초에서 시작한다");
  const text = { ...createLayer("text", doc), duration: 300 };
  const audio: VideoLayer = { ...text, id: crypto.randomUUID(), kind: "audio", assetId: crypto.randomUUID(), from: 200, duration: 400, sourceFrames: 400, trimStart: 0, trimEnd: 400, volume: 1, loop: false };
  const before = { ...doc, layers: [text, audio] };
  const end = appendFrame(before); assert.equal(end, 600);
  const clip: VideoLayer = { ...text, id: crypto.randomUUID(), kind: "video", assetId: crypto.randomUUID(), from: end, duration: 90, sourceFrames: 90, trimStart: 0, trimEnd: 90, volume: 1, loop: false, sequence: true, sequenceIndex: 0, sequenceStart: end, fit: "cover", cropX: 50, cropY: 50 };
  const after = reflowSequence({ ...before, layers: [...before.layers, clip] });
  assert.equal(after.layers.at(-1)?.from, end); assert.equal(after.layers[1].duration, 400);
  const extended = { ...clip, id: crypto.randomUUID(), duration: 30, trimEnd: 30, sequenceIndex: 1, sequenceStart: 0 };
  const shorter = { ...clip, duration: 45, trimEnd: 45 };
  assert.deepEqual(reflowSequence({ ...doc, layers: [shorter, extended] }).layers.map(l => l.from), [600, 645]);
});
