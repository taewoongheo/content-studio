import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, startProduction, syncState, resetProduction } from "../runner";
import type { DiscoveryBatch } from "../../../domain/discovery";

test("start collects once before dispatching all tasks, rejects concurrent starts and creates no drafts on search failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "production-start-"));
  const previous = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = "fixture-key";
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const batch: DiscoveryBatch = { query: "strength training", collected_at: new Date().toISOString(), posts: [] };
  const store = productionStore(), calls: string[] = [];
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  try {
    const services = {
      refreshMetrics: async () => { calls.push("metrics"); return 0; },
      collectDiscovery: async () => { calls.push("search"); await waiting; return batch; },
      execute: async (id: string) => { calls.push("execute"); assert.deepEqual(store.get(id).discovery, batch); },
    };
    const pending = startProduction(4, "http://127.0.0.1:3000", services);
    await Promise.resolve();
    assert.equal(store.list().length, 0);
    await assert.rejects(() => startProduction(1, "http://127.0.0.1:3000", services), /갱신/);
    release();
    const ids = await pending;
    assert.equal(ids.length, 4);
    assert.deepEqual(calls, ["metrics", "search", "execute", "execute", "execute", "execute"]);
    assert.deepEqual(syncState().report?.discovery, batch);
    resetProduction();
    await assert.rejects(() => startProduction(2, "http://127.0.0.1:3000", {
      ...services, collectDiscovery: async () => { throw new Error("Search unavailable"); },
    }), /Search unavailable/);
    assert.equal(store.list().length, 0);
    assert.equal(syncState().running, false);
    assert.equal(syncState().report?.state, "failed");
    assert.equal(syncState().report?.error, "Search unavailable");
  } finally {
    store.db.close(); rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previous;
  }
});
