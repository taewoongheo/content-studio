import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { previewRegion } from "./region";

test("영역 확대는 원본 PNG의 하단 픽셀을 보존한다", async () => {
  const source = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "white" } })
    .composite([{ input: await sharp({ create: { width: 180, height: 60, channels: 3, background: "black" } }).png().toBuffer(), left: 65, top: 1270 }]).png().toBuffer();
  const result = await previewRegion(source, { x: 0, y: 0.9, width: 0.35, height: 0.1 });
  const meta = await sharp(result).metadata();
  assert.equal(meta.width, 756);
  assert.equal(meta.height, 270);
  const pixel = await sharp(result).extract({ left: 160, top: 140, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.deepEqual([...pixel], [0, 0, 0]);
  await assert.rejects(previewRegion(source, { x: 0.9, y: 0, width: 0.2, height: 1 }), /확대 영역/);
});
