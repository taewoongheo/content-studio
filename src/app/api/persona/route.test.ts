import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET, POST } from "./route";
import { getLocalDatabase } from "@/lib/local-db/database";
import { replacePersona } from "@/domains/content-production/server/persona/store";
import { personaSections } from "@/domains/content-production/domain/persona/model";

test("persona routes require a local origin for writes and guard stale edits without changing analysis evidence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "persona-route-test-"));
  const previous = process.env.CONTENT_STUDIO_DB_PATH;
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const db = getLocalDatabase();
  const request = (body: unknown, origin: string | null = "http://127.0.0.1:3000") => new Request("http://127.0.0.1:3000/api/persona", {
    method: "POST", headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    const persona = replacePersona(db, { handle: "sample", name: "Sample", output_language: "English", analyzed_at: "now", updated_at: "now", analyzed_posts: 0,
      content: Object.fromEntries(personaSections.map(section => [section.id, Object.fromEntries(Object.keys(section.fields).map(key => [key, "Observation"]))])),
    });
    assert.equal((await POST(request({ action: "analyze", handle: "sample" }, null))).status, 403);
    assert.equal((await POST(request({ action: "analyze", handle: "sample" }, "https://other.example"))).status, 403);
    const settings = { name: "Edited", output_language: "English", content: persona.content };
    assert.equal((await POST(request({ action: "save", revision: 1, settings }))).status, 200);
    assert.equal((await POST(request({ action: "save", revision: 1, settings }))).status, 400);
    const response = await GET(new Request("http://127.0.0.1:3000/api/persona", { headers: { host: "127.0.0.1:3000" } }));
    const data = await response.json();
    assert.equal(data.persona.name, "Edited");
    assert.equal(data.persona.handle, "sample");
    assert.equal(data.persona.revision, 2);
    assert.equal(response.headers.get("cache-control"), "no-store");
  } finally {
    db.close();
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
