import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createStudioMcpServer } from "../server";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { createContentProject } from "@/domains/slideshow/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { readVideo } from "@/domains/video/server/service";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type Failure = { code: string; recovery: string; details: Record<string, unknown> };
const failure = (result: CallToolResult) => {
  assert.equal(result.isError, true);
  assert.equal(result.content[0].type, "text");
  return (result.structuredContent as { error: Failure }).error;
};

test("MCP schema, command and concurrency failures are structured and leave documents intact", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-errors-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const client = new Client({ name: "errors-test", version: "1" });
  const server = createStudioMcpServer("http://127.0.0.1:3000");
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const call = async (name: string, args: Record<string, unknown>) => await client.callTool({ name, arguments: args }) as CallToolResult;
    const tools = (await client.listTools()).tools;
    const input = tools.find(tool => tool.name === "create_video_project")!.inputSchema;
    assert.ok(input.properties?.settings); // SDK discovery still publishes the complete original schema.
    const invalid = failure(await call("create_video_project", { settings: { width: 99999 } }));
    assert.equal(invalid.code, "INVALID_INPUT");
    const issues = invalid.details.issues as Array<{ path: string[]; maximum?: number }>;
    assert.ok(issues.some(issue => issue.path.join(".") === "settings.width" && typeof issue.maximum === "number"));
    const job = createContentProject(contentJobRegistry, {});
    const args = { projectId: job.id, expectedTabId: job.tabId, expectedRevision: 0 };
    const bad = failure(await call("edit_project", { ...args, commands: [
      { type: "rename_slide", slideId: "slide-1", name: "should roll back" },
      { type: "remove_slide", slideId: "missing" },
    ] }));
    assert.equal(bad.code, "COMMAND_FAILED");
    assert.equal(bad.details.commandIndex, 1);
    assert.deepEqual(bad.details.target, { slideId: "missing" });
    assert.deepEqual(contentJobRegistry.get(job.id), job);
    const stale = failure(await call("edit_project", { ...args, expectedRevision: 5, commands: [{ type: "rename_slide", slideId: "slide-1", name: "stale" }] }));
    assert.equal(stale.code, "REVISION_CONFLICT"); assert.equal(stale.recovery, "read_latest");
    assert.equal(stale.details.actualRevision, 0); assert.equal(stale.details.expectedRevision, 5);
    const tab = failure(await call("undo_project", { ...args, expectedTabId: "old-tab" }));
    assert.equal(tab.code, "TAB_CONFLICT"); assert.equal(tab.details.actualTabId, job.tabId);
    const video = (await call("create_video_project", {})).structuredContent as { id: string; tabId: string; revision: number };
    const missingId = randomUUID();
    const failedVideo = failure(await call("edit_video_project", { projectId: video.id, expectedTabId: video.tabId, expectedRevision: 0,
      commands: [{ type: "add_layer", layer: { kind: "text" } }, { type: "remove_layer", layerId: missingId }] }));
    assert.equal(failedVideo.code, "COMMAND_FAILED"); assert.equal(failedVideo.details.commandIndex, 1);
    assert.deepEqual(failedVideo.details.target, { layerId: missingId });
    assert.equal(readVideo(video.id).revision, 0); assert.equal(readVideo(video.id).document.layers.length, 0);
    const unknown = failure(await call("invented_tool", {})); assert.equal(unknown.code, "TOOL_NOT_FOUND");
  } finally { await client.close(); await server.close(); getLocalDatabase().close(); await rm(directory, { recursive: true, force: true }); }
});
