import assert from "node:assert/strict";
import test from "node:test";
import { fittedImage, pixelFrame } from "./layout";
import { createArtworkImageLoader } from "./assets";

test("캔버스 밖 좌표를 유지하면서 문서 좌표를 원본 픽셀로 변환한다", () => {
  assert.deepEqual(pixelFrame({ x: -0.1, y: 0.2, width: 0.5, height: 0.4 }, { width: 1080, height: 1350 }),
    { x: -108, y: 270, width: 540, height: 540 });
});

test("이미지 contain은 비율과 중앙 정렬을 유지하고 cover는 넘치는 영역을 허용한다", () => {
  assert.deepEqual(fittedImage({ width: 200, height: 100 }, { width: 100, height: 100 }, "contain"),
    { x: 0, y: 25, width: 100, height: 50 });
  assert.deepEqual(fittedImage({ width: 200, height: 100 }, { width: 100, height: 100 }, "cover"),
    { x: -50, y: 0, width: 200, height: 100 });
});

test("동일 이미지 요청을 공유하고 decode 완료 후에만 렌더러에 제공한다", async (t) => {
  let requests = 0;
  let finishDecode!: () => void;
  class TestImage {
    naturalWidth = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { requests++; queueMicrotask(() => this.onload?.()); }
    decode() { return new Promise<void>((resolve) => { finishDecode = resolve; }); }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", { configurable: true, value: TestImage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "Image", original);
    else Reflect.deleteProperty(globalThis, "Image");
  });
  const load = createArtworkImageLoader();
  const first = load("/asset/webp");
  assert.equal(first, load("/asset/webp"));
  let settled = false;
  void first.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false);
  finishDecode();
  const image = await first;
  assert.equal(image.naturalWidth, 100);
  assert.equal(requests, 1);
});
