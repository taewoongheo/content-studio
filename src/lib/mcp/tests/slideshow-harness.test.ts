import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createStudioMcpServer } from "../server";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { createContentProject, saveContentProject } from "@/domains/slideshow/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";

test("슬라이드쇼 이름 변경은 문서를 보존하고 오래된 탭·revision은 거부한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-slideshow-harness-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const client = new Client({ name: "harness-test", version: "1" });
  const server = createStudioMcpServer("http://127.0.0.1:3000");
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const names = (await client.listTools()).tools.map(tool => tool.name);
    for (const name of ["rename_project", "preview_slides", "export_slideshow", "get_render_job", "cancel_render_job"]) assert.ok(names.includes(name));
    const job = createContentProject(contentJobRegistry, { name: "before" });
    saveContentProject(contentJobRegistry, job.id, "before");
    const result = await client.callTool({ name: "rename_project", arguments: { projectId: job.id, expectedTabId: job.tabId, expectedRevision: 0, name: "after" } });
    assert.equal(result.isError, undefined);
    assert.equal((result.structuredContent as { name: string }).name, "after");
    assert.deepEqual(contentJobRegistry.get(job.id).editor.document, job.editor.document);
    const rejected = await client.callTool({ name: "rename_project", arguments: { projectId: job.id, expectedTabId: job.tabId, expectedRevision: 0, name: "stale" } });
    assert.equal(rejected.isError, true);
    assert.equal(contentJobRegistry.get(job.id).name, "after");
  } finally { await client.close(); await server.close(); getLocalDatabase().close(); await rm(directory, { recursive: true, force: true }); }
});
