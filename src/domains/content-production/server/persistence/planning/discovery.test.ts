import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../store";
import { ApifyPhotoSearchClient } from "@/domains/research/server/apify/photo-search";
import { collectDiscovery, discoveryQueries, nextDiscoveryQuery } from "./discovery";
import { DISCOVERY_QUESTION } from "../../../domain/discovery";
const photo = { id: "123", url: "https://www.tiktok.com/@test/photo/123", mediaType: "photo", textLanguage: "en",
  description: "An example workout.", imageUrls: ["https://p.tiktokcdn.com/1.jpg", "https://p.tiktokcdn.com/2.jpg"], viewsCount: 100, likesCount: 5, commentsCount: 1, savesCount: 4 };
test("one batch seeds every parallel draft, survives agent saves and rotates queries across restarts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "discovery-")), db = openLocalDatabase(":memory:");
  const before = process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
  process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = directory;
  let requests = 0;
  const client = new ApifyPhotoSearchClient("key", async () => { requests++; return Response.json([photo]); });
  const capture = async () => [{ data: Buffer.from("image"), width: 10, height: 10 }];
  try {
    assert.equal(nextDiscoveryQuery(null), discoveryQueries[0]);
    assert.equal(nextDiscoveryQuery(discoveryQueries.at(-1)), discoveryQueries[0]);
    const batch = await collectDiscovery(db, client, capture);
    const store = new ProductionStore(db), ids = store.create(4, batch);
    assert.equal(requests, 1);
    for (const id of ids) {
      assert.deepEqual(store.get(id).discovery, batch);
      assert.deepEqual(store.get(id).analysis.research, []);
      store.state(id, "running");
      store.save(id, "analysis", { research: [{ question: "Topic", source: "https://example.com", finding: "This example gives the reader a clear workout they can use.", judgment: "Keep the answer clear." }] });
      store.save(id, "analysis", { research: [{ question: DISCOVERY_QUESTION, source: "", finding: "overwritten", judgment: "" }] });
      assert.deepEqual(new ProductionStore(db).get(id).discovery, batch);
    }
    assert.equal((db.prepare("SELECT count(*) n FROM content_references").get() as {n:number}).n, 0);
    const next = await collectDiscovery(db, client, async () => { throw new Error("CDN offline"); });
    assert.equal(next.query, discoveryQueries[1]);
    assert.equal(next.posts[0].visual_set_id, null);
    assert.match(next.posts[0].image_error!, /not be preserved/);
    assert.equal(next.posts[0].engagement_rate, .1);
  } finally {
    db.close(); rmSync(directory, { recursive: true, force: true });
    if (before === undefined) delete process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
    else process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = before;
  }
});
