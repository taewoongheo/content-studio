import assert from "node:assert/strict";
import test from "node:test";
import { serveRenderMedia } from "./http";
test("렌더 미디어는 임의 경로를 거부하고 정확한 부분 바이트를 제공한다", async () => {
  const media = await serveRenderMedia(new Map([["asset", { type: "video/mp4", bytes: Buffer.from("0123456789") }]]));
  try {
    const response = await fetch(media.sources.asset, { headers: { Range: "bytes=2-4" } });
    assert.equal(response.status, 206); assert.equal(await response.text(), "234");
    assert.equal((await fetch(media.sources.asset, { headers: { Range: "bytes=20-" } })).status, 416);
    assert.equal((await fetch(new URL("/wrong/asset", media.sources.asset))).status, 404);
  } finally { await media.close(); }
});
