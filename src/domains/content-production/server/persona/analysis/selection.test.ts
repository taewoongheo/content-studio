import assert from "node:assert/strict";
import test from "node:test";
import { ApifyAccountPostsClient } from "@/domains/research/server/apify/account-posts";
import { selectPersonaPosts } from "./selection";

function post(id: number, slideshow = true) {
  return { id: String(id), webVideoUrl: `https://www.tiktok.com/@sample/photo/${id}`, isSlideshow: slideshow,
    createTime: id, slideshowImageLinks: slideshow ? ["https://p.tiktokcdn.com/1.jpg", "https://p.tiktokcdn.com/2.jpg"] : [], textLanguage: "ko" };
}

test("selection preserves popular ordering, excludes overlaps from latest, and expands metadata without reading images", async () => {
  const calls: Array<[string, number]> = [];
  const client = new ApifyAccountPostsClient("test", async (_, options) => {
    const { profileSorting, resultsPerPage } = JSON.parse(String(options?.body));
    calls.push([profileSorting, resultsPerPage]);
    const raw = profileSorting === "popular"
      ? [post(4), post(9, false), post(1), post(2), post(3), post(5)]
      : [post(10), post(9, false), post(8), post(7), post(5), post(4), post(3), post(6), post(2), post(1), post(11)];
    return Response.json(raw.slice(0, resultsPerPage));
  });
  const selected = await selectPersonaPosts("sample", new AbortController().signal, client, () => {});
  assert.deepEqual(selected.filter(item => item.group === "popular").map(item => item.post.id), ["4", "1", "2", "3", "5"]);
  assert.deepEqual(selected.filter(item => item.group === "latest").map(item => item.post.id), ["11", "10", "8", "7", "6"]);
  assert.equal(new Set(selected.map(item => item.post.id)).size, 10);
  assert.deepEqual(calls, [["popular", 5], ["popular", 10], ["latest", 5], ["latest", 10], ["latest", 20]]);
});

test("filtered videos do not count as exhaustion; true exhaustion returns only the available unique posts", async () => {
  const calls: Array<[string, number]> = [];
  const client = new ApifyAccountPostsClient("test", async (_, options) => {
    const { profileSorting, resultsPerPage } = JSON.parse(String(options?.body));
    calls.push([profileSorting, resultsPerPage]);
    return Response.json([post(1, false), post(2, false), post(3, false), post(4, false), post(5, false), post(6)].slice(0, resultsPerPage));
  });
  const selected = await selectPersonaPosts("sample", new AbortController().signal, client, () => {});
  assert.deepEqual(selected.map(item => item.post.id), ["6"]);
  assert.deepEqual(calls, [["popular", 5], ["popular", 10], ["latest", 5], ["latest", 10]]);
});

test("selection stops at its metadata cap and does not duplicate posts to fill a group", async () => {
  const calls: number[] = [];
  const client = new ApifyAccountPostsClient("test", async (_, options) => {
    const { resultsPerPage } = JSON.parse(String(options?.body));
    calls.push(resultsPerPage);
    return Response.json(Array.from({ length: resultsPerPage }, (_, index) => post(index + 1, false)));
  });
  assert.deepEqual(await selectPersonaPosts("sample", new AbortController().signal, client, () => {}), []);
  assert.deepEqual(calls, [5, 10, 20, 40, 80, 100, 5, 10, 20, 40, 80, 100]);
});
