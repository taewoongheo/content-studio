import assert from "node:assert/strict";
import test from "node:test";
import { solutionDistance } from "./captcha";
import { normalizeTikTok } from "../collectors/tiktok";
import { displayedCount } from "../collectors/youtube";

test("solver recognition cannot move outside the challenge control", () => {
  const geometry = { backgroundX: 10, pieceX: 15, trackWidth: 300, handleWidth: 30 };
  assert.equal(solutionDistance({ x: 105 }, "slider", geometry), 100);
  assert.equal(solutionDistance({ x: 210 }, "slider", { ...geometry, imageScale: 0.5 }), 100);
  assert.equal(solutionDistance({ cw: 180 }, "rotate", geometry), 135);
  assert.throws(() => solutionDistance({ x: 9999 }, "slider", geometry));
  assert.throws(() => solutionDistance({ cw: NaN }, "rotate", geometry));
});
test("platform normalization preserves absent reaction counts and image order", () => {
  const post = normalizeTikTok({ id_str: "123", desc: "tips", statistics_info: { digg_count: 0 },
    image_post_info: { images: ["a", "b"].map(id => ({ display_image: { url_list: [`https://p16.tiktokcdn.com/${id}.jpg`] } })) } }, "https://www.tiktok.com/@a/photo/123");
  assert.equal(post.metrics.likeCount, 0); assert.equal(post.metrics.viewCount, null);
  assert.equal(post.format, "slideshow"); assert.ok(post.media[1].url.endsWith("b.jpg"));
  assert.equal(displayedCount("5.3M"), 5_300_000); assert.equal(displayedCount("Like"), null);
});
