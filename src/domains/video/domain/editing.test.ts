import assert from "node:assert/strict";
import test from "node:test";
import { adjustLayerTiming, updateVideoLayer } from "@/domains/video/domain/editing";
import { createLayer, newVideoDocument, reflowSequence, type VideoLayer } from "@/domains/video/domain/model";

function clip(overrides: Partial<Extract<VideoLayer, { kind: "video" }>> = {}): Extract<VideoLayer, { kind: "video" }> {
  return {
    ...createLayer("shape", newVideoDocument()),
    kind: "video", assetId: crypto.randomUUID(), from: 30, duration: 60,
    sourceFrames: 180, trimStart: 30, trimEnd: 90,
    volume: 1, loop: false, fit: "cover", cropX: 50, cropY: 50,
    ...overrides,
  };
}

test("타임라인 이동은 원본 구간을 유지하고 문서 경계에서 멈춘다", () => {
  const layer = clip();
  assert.equal(adjustLayerTiming(layer, -60, "move").from, 0);
  const moved = adjustLayerTiming(layer, 108000, "move");
  assert.equal(moved.from + moved.duration, 108000);
  assert.equal(moved.kind === "video" && moved.trimStart, 30);
  assert.equal(moved.kind === "video" && moved.trimEnd, 90);
  assert.equal(layer.from, 30);
});

test("오디오 자르기는 원본 프레임과 재생 길이를 함께 바꾸며 원본을 넘지 않는다", () => {
  const layer: VideoLayer = { ...clip(), kind: "audio" };
  const start = adjustLayerTiming(layer, 20, "start");
  assert.equal(start.kind, "audio");
  assert.equal(start.from, 50);
  assert.equal(start.duration, 40);
  assert.equal(start.kind === "audio" && start.trimStart, 50);
  const end = adjustLayerTiming(layer, 1000, "end");
  assert.equal(end.duration, 150);
  assert.equal(end.kind === "audio" && end.trimEnd, 180);
  assert.equal(adjustLayerTiming(layer, 1000, "start").duration, 1);
});

test("연결 영상은 원본 앞부분을 복원하고 뒤 클립을 밀며 반복 영상은 트림을 유지한다", () => {
  const layer = clip({ from: 0, sequence: true, sequenceIndex: 0 });
  const restored = adjustLayerTiming(layer, -20, "start");
  const second = clip({ sequence: true, sequenceIndex: 1, from: 60 });
  const doc = reflowSequence({ ...newVideoDocument(), layers: [restored, second] });
  assert.equal(doc.layers[0].from, 0);
  assert.equal(doc.layers[0].duration, 80);
  assert.equal(doc.layers[1].from, 80);
  const loop = adjustLayerTiming({ ...layer, loop: true }, 500, "end");
  assert.equal(loop.duration, 560);
  assert.equal(loop.kind === "video" && loop.trimEnd, 90);
});

test("연결 영상 이동은 재생 순서만 바꾸고 독립 요소와 시각적 쌓임 순서를 보존한다", () => {
  const first = clip({ from: 0, sequence: true, sequenceIndex: 0 });
  const second = clip({ from: 60, sequence: true, sequenceIndex: 1 });
  const overlay = clip({ from: 15, sequence: false });
  const doc = { ...newVideoDocument(), layers: [first, overlay, second] };
  const moved = reflowSequence(updateVideoLayer(doc, { ...first, from: 95 }));
  assert.deepEqual(moved.layers.map(layer => layer.id), doc.layers.map(layer => layer.id));
  assert.deepEqual(moved.layers.map(layer => layer.from), [60, 15, 0]);
  assert.equal(doc.layers[0].from, 0);
});

test("스타일 변경과 시작 자르기는 연결 영상의 순서를 바꾸지 않는다", () => {
  const first = clip({ from: 0, sequence: true, sequenceIndex: 0 });
  const second = clip({ from: 60, sequence: true, sequenceIndex: 1 });
  const doc = { ...newVideoDocument(), layers: [first, second] };
  const styled = updateVideoLayer(doc, { ...second, opacity: 0.5 });
  const trimmed = reflowSequence(updateVideoLayer(styled, adjustLayerTiming(first, 20, "start")));
  assert.deepEqual(trimmed.layers.map(layer => layer.from), [0, 40]);
  assert.equal(trimmed.layers[1].opacity, 0.5);
});
