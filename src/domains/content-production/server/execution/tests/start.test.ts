import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, startProduction, syncState, resetProduction } from "../runner";

test("start refreshes own metrics once and dispatches tasks without external collection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "production-start-"));
  const previous = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = "fixture-key";
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const store = productionStore(), calls: string[] = [];
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  try {
    store.db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Post','4:5',1,'English','{}','now','now')").run();
    store.db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at) VALUES('l','p','https://example.com/post','2026-10-25',100,1,1,1,'now','now')").run();
    const services = {
      refreshMetrics: async () => { calls.push("metrics"); await waiting; store.db.prepare("UPDATE content_creation_logs SET like_count=25 WHERE id='l'").run(); return 1; },
      execute: async () => { calls.push("execute"); },
    };
    const pending = startProduction(4, "http://127.0.0.1:3000", services);
    assert.equal(store.list().length, 0);
    await assert.rejects(() => startProduction(1, "http://127.0.0.1:3000", services), /갱신/);
    release();
    const ids = await pending;
    assert.equal(ids.length, 4);
    for (const id of ids) assert.equal(store.analysisInputs(id)[0].like_count,25,"selection happens after refresh, before every dispatch");
    assert.deepEqual(calls, ["metrics", "execute", "execute", "execute", "execute"]);
    assert.equal(syncState().report?.state,"completed");
    resetProduction();
    await assert.rejects(() => startProduction(2, "http://127.0.0.1:3000", {
      ...services, refreshMetrics: async () => { throw new Error("Metrics unavailable"); },
    }), /Metrics unavailable/);
    assert.equal(store.list().length, 0);
    assert.equal(syncState().running, false);
  } finally {
    store.db.close(); rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previous;
  }
});
