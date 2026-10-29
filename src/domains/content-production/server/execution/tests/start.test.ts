import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, startProduction, syncState, resetProduction } from "../runner";

test("start uses stored metrics without collecting performance", async () => {
  const directory = mkdtempSync(join(tmpdir(), "production-start-"));
  const previous = process.env.APIFY_API_TOKEN;
  process.env.APIFY_API_TOKEN = "fixture-key";
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const store = productionStore(), calls: string[] = [];

  try {
    store.db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','Post','4:5',1,'English','{}','now','now')").run();
    store.db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,view_count,like_count,comment_count,save_count,created_at,updated_at) VALUES('l','p','https://example.com/post','2026-10-25',100,1,1,1,'now','now')").run();
    const services = {
      execute: async () => { calls.push("execute"); },
    };
    const ids = await startProduction(4, "http://127.0.0.1:3000", {...services, refreshSpy: async () => ({}) as never});
    assert.equal(ids.length,4);
    assert.deepEqual(calls,["execute","execute","execute","execute"]);
    for (const id of ids) assert.equal(store.analysisInputs(id)[0].like_count,1);
    assert.equal(syncState().running,false);
    resetProduction();
  } finally {
    store.db.close(); rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previous;
  }
});
