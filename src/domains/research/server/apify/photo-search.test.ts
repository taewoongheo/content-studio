import test from "node:test";
import assert from "node:assert/strict";
import { ApifyPhotoSearchClient, parsePhotoSearch } from "./photo-search";
const photo = { id: "123", url: "https://www.tiktok.com/@test/photo/123", mediaType: "photo", textLanguage: "en",
  imageUrls: ["https://p.tiktokcdn.com/1.jpg", "https://p.tiktokcdn.com/2.jpg"], viewsCount: 100, likesCount: 5, commentsCount: 1, savesCount: 4 };
test("photo search reuses the key, caps total results at five and requests popular US English photos", async () => {
  const client = new ApifyPhotoSearchClient("same-key", async (url, options) => {
    assert.match(String(url), /scrapingmonkey~tiktok-scraper/);
    assert.match(String(url), /maxTotalChargeUsd=0.10/);
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer same-key");
    const input = JSON.parse(String(options?.body));
    assert.deepEqual(input.searchTerms, ["weight training"]);
    assert.equal(input.mode, "searchPhotos");
    assert.equal(input.maxTotalResults, 5);
    assert.equal(input.sort, "popular");
    assert.equal(input.language, "en");
    return Response.json([photo]);
  });
  const [result] = await client.search("weight training");
  assert.equal(result.engagement_rate, .1);
  assert.equal(result.share_count, null);
  await assert.rejects(() => new ApifyPhotoSearchClient("").search("training"), /APIFY/);
  await assert.rejects(() => new ApifyPhotoSearchClient("key", async () => new Response("failed", { status: 403 })).search("training"), /403/);
});
test("results deduplicate and exclude video/foreign/unsafe rows without inventing missing metrics", () => {
  const rows = parsePhotoSearch([photo, photo, { ...photo, id: "124", url: "https://www.tiktok.com/@test/photo/124", savesCount: null, textLanguage: "un" },
    { ...photo, textLanguage: "ko" }, { ...photo, mediaType: "video" }, { ...photo, url: "http://localhost/123" },
    { ...photo, imageUrls: ["https://localhost/1", "https://localhost/2"] }, { nonsense: true }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[1].save_count, null);
  assert.equal(rows[1].engagement_rate, null);
  assert.equal(parsePhotoSearch(Array.from({ length: 9 }, (_, i) => ({ ...photo, id: `${i}`, url: `https://www.tiktok.com/@test/photo/${i}` }))).length, 5);
});
