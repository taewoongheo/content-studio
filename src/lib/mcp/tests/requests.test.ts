import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createStudioMcpServer } from "../server";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { createContentProject, saveContentProject } from "@/domains/slideshow/projects/service";
import { videoTabs } from "@/domains/video/server/service";
import { getLocalDatabase } from "@/lib/local-db/database";

test("creation and clones replay across MCP connections without new tabs, even after source changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-requests-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  async function connect() {
    const server = createStudioMcpServer("http://127.0.0.1:3000"), client = new Client({ name: "requests-test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(b); await client.connect(a);
    return { server, client, call: async (name: string, args: Record<string, unknown>) => await client.callTool({ name, arguments: args }) as CallToolResult };
  }
  const first = await connect(), second = await connect();
  try {
    const base = createContentProject(contentJobRegistry, {}); saveContentProject(contentJobRegistry, base.id, "template");
    const registrationArgs = { requestId: randomUUID(), projectId: base.id, slideIds: base.editor.document.slides.map(slide => slide.id), templateName: "Template", templateTopic: "Guide", templateMessage: "Compare", composition: "한 장에 짧은 정보를 전달하는 구성" };
    const [registered, registrationReplay] = await Promise.all([first.call("register_template", registrationArgs), second.call("register_template", registrationArgs)]);
    assert.deepEqual(registrationReplay, registered);
    const templateId = (registered.structuredContent as { template: { id: string } }).template.id;
    const args = { templateId, requestId: randomUUID(), name: "one clone" };
    const [a, b] = await Promise.all([first.call("clone_project", args), second.call("clone_project", args)]);
    assert.equal(a.isError, undefined); assert.deepEqual(a, b); assert.equal(contentJobRegistry.list().length, 2);
    await first.call("unregister_template", { templateId });
    assert.deepEqual(await second.call("clone_project", args), a, "replay precedes current source validation");
    const conflict = await second.call("clone_project", { ...args, name: "changed" });
    assert.equal(conflict.isError, true);
    assert.equal((conflict.structuredContent as { error: { code: string } }).error.code, "REQUEST_ID_REUSED");
    assert.equal(contentJobRegistry.list().length, 2);
    const videoArgs = { requestId: randomUUID(), name: "one video" };
    const [created, retried] = await Promise.all([first.call("create_video_project", videoArgs), second.call("create_video_project", videoArgs)]);
    assert.deepEqual(created, retried); assert.equal(videoTabs().length, 1);
    const video = created.structuredContent as { id: string; tabId: string };
    await first.call("edit_video_project", { projectId: video.id, expectedTabId: video.tabId, expectedRevision: 0,
      commands: [{ type: "add_layer", layer: { kind: "text" } }] });
    const cloneArgs = { projectId: video.id, expectedTabId: video.tabId, expectedRevision: 1, requestId: randomUUID() };
    const copy = await first.call("clone_video_project", cloneArgs); assert.equal(copy.isError, undefined);
    await first.call("edit_video_project", { projectId: video.id, expectedTabId: video.tabId, expectedRevision: 1,
      commands: [{ type: "add_layer", layer: { kind: "shape" } }] });
    assert.deepEqual(await second.call("clone_video_project", cloneArgs), copy); assert.equal(videoTabs().length, 2);
    const old = await first.call("create_video_project", {}), other = await first.call("create_video_project", {});
    assert.notEqual(old.structuredContent!.id, other.structuredContent!.id, "legacy calls without requestId still create independently");
    const count = videoTabs().length;
    assert.equal((await first.call("create_video_project", { requestId: " " })).isError, true);
    assert.equal(videoTabs().length, count);
  } finally {
    for (const connection of [first, second]) { await connection.client.close(); await connection.server.close(); }
    getLocalDatabase().close(); await rm(directory, { recursive: true, force: true });
  }
});
