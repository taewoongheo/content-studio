import assert from "node:assert/strict";
import test from "node:test";
import { emptyMetrics, evaluateCriteria, type SocialPost } from "./schema";
import { isMediaUrl, socialSource } from "./source";

const post: SocialPost = { id: "1", platform: "tiktok", url: "https://www.tiktok.com/@a/photo/1",
  author: "a", text: "routine", format: "slideshow", publishedAt: null, publishedLabel: null,
  collectedAt: new Date().toISOString(), media: [], metrics: emptyMetrics() };
test("unknown views cannot satisfy the threshold; an explicit zero is known", () => {
  assert.equal(evaluateCriteria(post, { minViews: 100_000 }).status, "unverified");
  assert.equal(evaluateCriteria({ ...post, metrics: { ...post.metrics, viewCount: 0 } }, { minViews: 100_000 }).status, "failed");
  assert.equal(evaluateCriteria({ ...post, metrics: { ...post.metrics, viewCount: 100_000 } }, { minViews: 100_000 }).status, "passed");
  assert.equal(evaluateCriteria(post, { format: "video", minViews: 100_000 }).status, "failed");
});
test("source URLs and media redirects are constrained to platform hosts", () => {
  assert.equal(socialSource("https://www.tiktok.com/@hullcity/photo/7553302113757990166?x=1", "post").id, "7553302113757990166");
  assert.equal(socialSource("https://www.youtube.com/@JeffNippard/posts", "account").platform, "youtube");
  for (const url of ["http://localhost/p/a", "https://www.instagram.com.evil.test/p/a", "https://user:pass@www.instagram.com/p/a", "https://www.instagram.com:444/p/a"]) {
    assert.throws(() => socialSource(url, "post"));
  }
  assert.ok(isMediaUrl("https://p16-common-sign.tiktokcdn.com/image.jpeg"));
  assert.ok(!isMediaUrl("https://tiktokcdn.com.evil.test/image.jpeg"));
  assert.ok(!isMediaUrl("http://127.0.0.1/image"));
});
