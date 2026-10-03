import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { imageRenderSize, resampledDimensions } from "./options";
import { resampleImage } from "./resample";
import { createRenderImageCache } from "./cache";

test("원본 요청은 유지하고 잘못된 렌더 크기와 fit은 거부한다", () => {
  assert.equal(imageRenderSize(new URLSearchParams()), null);
  assert.deepEqual(imageRenderSize(new URLSearchParams("width=320&height=180&fit=contain")), { width: 320, height: 180, fit: "contain" });
  for (const query of ["width=10", "width=0&height=20&fit=cover", "width=4097&height=1&fit=contain",
    "width=1.5&height=1&fit=cover", "width=20&height=20&fit=fill"])
    assert.throws(() => imageRenderSize(new URLSearchParams(query)), /렌더 크기/);
});

test("contain·cover의 원본 비율과 전체 이미지를 유지하고 확대하지 않는다", () => {
  assert.deepEqual(resampledDimensions({ width: 300, height: 150 }, { width: 100, height: 100, fit: "contain" }), { width: 100, height: 50 });
  assert.deepEqual(resampledDimensions({ width: 300, height: 150 }, { width: 100, height: 100, fit: "cover" }), { width: 200, height: 100 });
  assert.deepEqual(resampledDimensions({ width: 30, height: 15 }, { width: 100, height: 100, fit: "cover" }), { width: 30, height: 15 });
  assert.deepEqual(resampledDimensions({ width: 20000, height: 100 }, { width: 4096, height: 4096, fit: "cover" }), { width: 4096, height: 20 });
});

test("Lanczos 축소는 고주파 패턴을 평탄화하고 투명도·원본 바이트를 보존한다", async () => {
  const raw = Buffer.alloc(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const offset = (y * 64 + x) * 4;
    const color = (x + y) % 2 ? 255 : 0;
    raw.set([color, color, color, 128], offset);
  }
  const bytes = await sharp(raw, { raw: { width: 64, height: 64, channels: 4 } }).png().toBuffer();
  const before = Buffer.from(bytes);
  const image = await resampleImage({ bytes, type: "image/png" }, { width: 8, height: 8, fit: "contain" });
  const { data, info } = await sharp(image.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 8);
  assert.equal(info.height, 8);
  assert.equal(info.channels, 4);
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(data[i] > 110 && data[i] < 145, `filtered pixel: ${data[i]}`);
    assert.ok(Math.abs(data[i + 3] - 128) <= 1);
  }
  assert.deepEqual(bytes, before);
  const original = { bytes, type: "image/png" };
  assert.equal(await resampleImage(original, { width: 128, height: 128, fit: "contain" }), original);
});

test("캐시는 동시 요청을 합치고 크기·내용별 구분과 LRU 용량 제한을 지킨다", async () => {
  let calls = 0;
  const render = createRenderImageCache({ maxBytes: 4, maxEntries: 2, transform: async (source) => {
    calls++; return { bytes: Uint8Array.from(source.bytes), type: source.type };
  } });
  const a = { bytes: Uint8Array.of(1, 1), type: "image/png" };
  const b = { bytes: Uint8Array.of(2, 2), type: "image/png" };
  const c = { bytes: Uint8Array.of(3, 3), type: "image/png" };
  const size = { width: 10, height: 10, fit: "contain" as const };
  const first = render(a, size);
  assert.equal(render(a, size), first);
  await first;
  await render(b, size);
  await render(a, size); // Refresh A; B becomes oldest.
  await render(c, size);
  await render(a, size);
  assert.equal(calls, 3);
  await render(b, size);
  assert.equal(calls, 4);
  await render(b, { ...size, width: 20 });
  assert.equal(calls, 5);
});

test("처리 실패는 캐시하지 않아 재시도할 수 있다", async () => {
  let calls = 0;
  const render = createRenderImageCache({ transform: async (source) => {
    if (++calls === 1) throw new Error("temporary");
    return source;
  } });
  const source = { bytes: Uint8Array.of(1), type: "image/png" };
  const size = { width: 10, height: 10, fit: "cover" as const };
  await assert.rejects(render(source, size), /temporary/);
  assert.equal(await render(source, size), source);
  assert.equal(calls, 2);
});
