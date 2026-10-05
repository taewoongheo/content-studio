import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "playwright";
import { collectTikTok } from "./tiktok";
import { socialSource } from "../domain/source";

test("account sampling ignores missing IDs before applying the requested limit", async () => {
  const state = { source: { data: { creator: { videoList: [{ desc: "missing" }, { id: "1" }, { id: "2" }, { id: "3" }] } } } };
  const page = {
    async goto() { return { status: () => 200 }; },
    locator(selector: string) { return selector === "body" ? { innerText: async () => "profile" } : { count: async () => 0 }; },
    url: () => "https://www.tiktok.com/@fitness",
    context() { return { request: { async get() { return {
      status: () => 200, ok: () => true,
      text: async () => `<script id="__FRONTITY_CONNECT_STATE__">${JSON.stringify(state)}</script>`,
    }; } } }; },
  } as unknown as Page;
  const result = await collectTikTok({ source: socialSource(page.url(), "account"), kind: "account", limit: 2 },
    { sessionId: "test", signal: new AbortController().signal, getPage: async () => page });
  assert.deepEqual(result.posts.map(post => post.id), ["1", "2"]);
});
