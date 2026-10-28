import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { productionStore, execute } from "../runner";

test("URL collection failure stops only that analysis node before invoking the production CLI", async () => {
  const directory = mkdtempSync(join(tmpdir(), "production-source-failure-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const previous = process.env.APIFY_API_TOKEN;
  delete process.env.APIFY_API_TOKEN;
  const store = productionStore();
  try {
    const [id, other] = store.create([
      { mode: "external_url", url: "https://www.tiktok.com/@example/photo/123", instructions: "Keep topic" },
      { mode: "automatic", instructions: "" },
    ], []);
    let invoked = false;
    await execute(id, "http://127.0.0.1:3000", async () => { invoked = true; return {}; });
    assert.equal(invoked, false);
    const detail = store.get(id);
    assert.equal(detail.task.current_step, "analysis");
    assert.equal(detail.task.state, "failed");
    assert.equal((detail.analysis.error as { phase: string }).phase, "source_collection");
    assert.equal(detail.input?.request.instructions, "Keep topic");
    assert.equal(store.get(other).task.state, "pending");
  } finally {
    store.db.close(); rmSync(directory, { recursive: true, force: true });
    if (previous === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previous;
  }
});
