import assert from "node:assert/strict";
import test from "node:test";
import { parseTikTokSearch } from "./tiktok";
import { parseInstagramSearch } from "./instagram";
import { evaluateCriteria } from "../../domain/schema";
test("native TikTok slideshow search retains order and available reaction counts", () => {
  const result = parseTikTokSearch({ data: [{ item: { id: "123", author: { uniqueId: "fitness" }, desc: "routine",
    stats: { playCount: 120000, diggCount: 2000 }, imagePost: { images: [
      { imageURL: { urlList: ["https://cdn.tiktokcdn.com/one.jpg"] } }, { imageURL: { urlList: ["https://cdn.tiktokcdn.com/two.jpg"] } },
    ] } } }] });
  assert.equal(result.posts[0].url, "https://www.tiktok.com/@fitness/photo/123");
  assert.equal(result.posts[0].format, "slideshow"); assert.equal(result.posts[0].media.length, 2);
  assert.equal(result.posts[0].metrics.viewCount, 120000); assert.equal(result.posts[0].metrics.saveCount, null);
  assert.equal(evaluateCriteria(result.posts[0], { minViews: 100000 }).status, "passed");
});
test("native TikTok accounts are not invented from post authors or arbitrary URLs", () => {
  const result = parseTikTokSearch({ user_list: [{ user_info: { uid: "42", unique_id: "trainer", nickname: "Trainer", follower_count: 100 } },
    { user_info: { unique_id: "../../malicious" } }] });
  assert.equal(result.accounts.length, 1); assert.equal(result.accounts[0].username, "trainer");
  assert.equal(parseTikTokSearch({ unexpected: [] }).recognized, false);
});
test("Instagram SERP normalizes nested accounts and carousel without inventing view or save counts", () => {
  const result = parseInstagramSearch({ data: { xdt_api__v1__fbsearch__web__top_serp: {
    users: [{ user: { username: "trainer", pk: "1", full_name: "Trainer" } }], media_grid: { sections: [{ layout_content: { medias: [{ media: {
      code: "ABC", media_type: 8, caption: { text: "Workout" }, user: { username: "trainer" }, like_count: 300,
      carousel_media: [{ image_versions2: { candidates: [{ url: "https://cdn.cdninstagram.com/a.jpg", width: 100, height: 100 }] } },
        { image_versions2: { candidates: [{ url: "https://cdn.cdninstagram.com/b.jpg" }] } }],
    } }] } }] },
  } } });
  assert.equal(result.accounts[0].url, "https://www.instagram.com/trainer/");
  assert.equal(result.posts[0].format, "slideshow"); assert.equal(result.posts[0].media.length, 2);
  assert.equal(result.posts[0].text, "Workout"); assert.equal(result.posts[0].metrics.viewCount, null);
  assert.equal(evaluateCriteria(result.posts[0], { minViews: 100000 }).status, "unverified");
  assert.equal(parseInstagramSearch({ unrelated: { username: "suggested" } }).recognized, false);
});
test("Instagram home-feed media cannot be mistaken for native keyword search results", () => {
  const result = parseInstagramSearch({ data: { feed: { items: [{ code: "FEED", media_type: 1, user: { username: "suggested" },
    image_versions2: { candidates: [{ url: "https://cdn.cdninstagram.com/feed.jpg" }] } }] } } });
  assert.equal(result.recognized, false); assert.deepEqual(result.posts, []); assert.deepEqual(result.accounts, []);
});
