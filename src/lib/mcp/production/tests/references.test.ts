import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createStudioMcpServer } from "../../server";
import { productionStore } from "@/domains/content-production/server/execution/runner";

test("task MCP exposes bounded external selection and English description persistence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-external-tools-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const store = productionStore();
  for (let n = 0; n < 6; n++) store.db.prepare(`INSERT INTO content_external_references
    (id,url,account,caption,observed_at,images_json,created_at)
    VALUES(?,?,'example','Arm workout','now','[]','now')`)
    .run(String(n), `https://www.tiktok.com/@example/photo/${n}`);
  const [id] = store.create(1);
  store.state(id, "running");
  const observations: Array<{name:string;result?:CallToolResult}> = [];
  const server = createStudioMcpServer("http://127.0.0.1:3000", {
    allowed: new Set(["production_external_references","production_describe_reference","production_save_draft","production_context"]),
    before() {}, observe(event) { observations.push(event); },
  }, id);
  const client = new Client({ name: "external-tools-test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const call = async (name: string, args = {}) => await client.callTool({ name, arguments: args }) as CallToolResult;
  try {
    await server.connect(b); await client.connect(a);
    const names = (await client.listTools()).tools.map(tool => tool.name);
    assert.ok(names.includes("production_external_references"));
    assert.ok(names.includes("production_describe_reference"));
    const first = await call("production_external_references");
    assert.ok(!first.isError);
    const posts = first.structuredContent!.posts as Array<{ id: string }>;
    assert.equal(posts.length, 5);
    const repeated = await call("production_external_references", { query: "Arm" });
    assert.deepEqual(repeated.structuredContent!.posts, posts);
    assert.equal((await call("production_external_references", { ids: ["0", "1", "2", "3", "4", "5"] })).isError, true);
    assert.equal((await call("production_describe_reference", {
      id: posts[0].id, title: "Arm plan", topic: "Arms", content_type: "routine", message: "Large movement images and short prescriptions.",
    })).isError, undefined);
    assert.equal((store.db.prepare("SELECT title FROM content_external_references WHERE id=?").get(posts[0].id) as { title: string }).title, "Arm plan");
    const unselected = ["0", "1", "2", "3", "4", "5"].find(value => !posts.some(post => post.id === value))!;
    assert.equal((await call("production_describe_reference", {
      id: unselected, title: "Unknown", topic: "Arms", content_type: "routine", message: "Not inspected.",
    })).isError, true);
    await call("production_save_draft", { patch: { research: [] } });
    assert.ok(observations.some(event=>event.name === "production_external_references" && event.result?.isError &&
      (event.result.structuredContent?.error as {code:string}).code === "INVALID_INPUT"), "schema rejection must be observed too");
    const context = (await call("production_context")).structuredContent!;
    assert.equal((context.external as { analysis: { posts: unknown[] } }).analysis.posts.length, 5);
  } finally {
    await client.close(); await server.close(); store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
