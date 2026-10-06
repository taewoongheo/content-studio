import assert from "node:assert/strict";
import test from "node:test";
import { Innertube, YTNodes } from "youtubei.js";
import { searchYouTube } from "./youtube";
import type { CollectorContext } from "../../collection/types";

test("YouTube search counts accepted results rather than unsupported renderers toward the limit", async t => {
  const videos = ["first", "second", "third"].map(videoId => new YTNodes.Video({
    videoId, title: { simpleText: videoId }, thumbnail: { thumbnails: [] },
  }));
  const channels = ["one", "two", "three"].map(channelId => new YTNodes.Channel({
    channelId, title: { simpleText: channelId }, thumbnail: { thumbnails: [] }, navigationEndpoint: {},
  }));
  const unsupported = new YTNodes.Message({ text: { simpleText: "Other renderer" } });
  t.mock.method(Innertube, "create", async () => ({
    search: async (_query: string, options: { type: string }) => ({
      results: [unsupported, ...(options.type === "channel" ? channels : videos)],
    }),
  } as unknown as Awaited<ReturnType<typeof Innertube.create>>));
  const context = { signal: new AbortController().signal } as CollectorContext;
  for (const type of ["posts", "accounts"] as const) {
    const result = await searchYouTube({ platform: "youtube", query: "fitness", type, limit: 2 }, context);
    assert.deepEqual(result.posts.map(post => post.id), type === "posts" ? ["first", "second"] : []);
    assert.deepEqual(result.accounts.map(account => account.id), type === "accounts" ? ["one", "two"] : []);
  }
});
