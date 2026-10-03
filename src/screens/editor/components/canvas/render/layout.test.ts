import assert from "node:assert/strict";
import test from "node:test";
import { fittedImage, pixelFrame, renderImageUrl } from "./layout";
import { createArtworkImageLoader, loadArtworkImages } from "./assets";

test("편집기는 실패한 이미지만 비워 두고 정상 이미지를 유지하며 내보내기는 누락을 알린다", async () => {
  const image = { naturalWidth: 100, naturalHeight: 100 } as HTMLImageElement;
  const requests = [{ placementId: "missing", url: "/missing" }, { placementId: "valid", url: "/valid" }];
  const load = async (url: string) => {
    if (url === "/missing") throw new Error("missing asset");
    return image;
  };
  const images = await loadArtworkImages(requests, load, true);
  assert.equal(images.has("missing"), false);
  assert.equal(images.get("valid"), image);
  await assert.rejects(loadArtworkImages(requests, load, false), /내보내기를 중단했습니다/);
});

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
    naturalHeight = 100;
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

test("렌더 이미지 URL은 최종 픽셀 크기와 fit으로 캐시를 구분하며 과대 크기는 비율대로 제한한다", () => {
  const url = new URL(renderImageUrl("job/a", "asset/b", { width: 320.2, height: 180.1 }, "cover"), "http://localhost");
  assert.equal(url.pathname, "/api/content-jobs/job%2Fa/assets/asset%2Fb");
  assert.equal(url.search, "?width=321&height=181&fit=cover");
  const large = new URL(renderImageUrl("job", "asset", { width: 8192, height: 4096 }, "contain"), "http://localhost");
  assert.equal(large.search, "?width=4096&height=2048&fit=contain");
});

test("디코딩 이미지 캐시는 픽셀 메모리 용량을 기준으로 오래된 이미지를 제거한다", async (t) => {
  let requests = 0;
  class TestImage {
    naturalWidth = 10;
    naturalHeight = 10;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { requests++; queueMicrotask(() => this.onload?.()); }
    async decode() {}
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, "Image");
  Object.defineProperty(globalThis, "Image", { configurable: true, value: TestImage });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "Image", original);
    else Reflect.deleteProperty(globalThis, "Image");
  });
  const load = createArtworkImageLoader({ maxBytes: 800, maxEntries: 40 });
  await load("a"); await load("b"); await load("a"); await load("c");
  await load("a");
  assert.equal(requests, 3);
  await load("b");
  assert.equal(requests, 4);
});
