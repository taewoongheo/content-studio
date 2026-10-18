import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createStudioMcpServer } from "../server";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { createContentProject, saveContentProject } from "@/domains/slideshow/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { POST } from "@/app/api/content-templates/route";

const origin = "http://localhost:3000";
test("MCP copies selected pages into an independent editable template and returns batch warnings", async () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-template-mcp-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "db.sqlite");
  const client = new Client({ name: "template-test", version: "1.0" }), server = createStudioMcpServer(origin);
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b); await client.connect(a);
    const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
    const source = createContentProject(contentJobRegistry, { name: "Source" }); saveContentProject(contentJobRegistry, source.id, "Source");
    const projects = new ContentProjectStore(getLocalDatabase()), before = projects.get(source.id);
    const input = { projectId: source.id, slideIds: ["slide-2"], templateName: "Template", templateTopic: "Guide", templateMessage: "Compare options", composition: "Image and explanation" };
    assert.equal((await call("clone_project", { templateId: source.id })).isError, true);
    assert.equal((await call("register_template", { ...input, slideIds: [] })).isError, true);
    const registered = await call("register_template", input); assert.equal(registered.isError, undefined);
    const template = (registered.structuredContent as { template: { id: string } }).template;
    assert.notEqual(template.id, source.id); assert.deepEqual(projects.get(source.id), before);
    const guides = (await call("list_template_guides", {})).structuredContent as { templates: Record<string, unknown>[] };
    assert.equal(guides.templates.length, 1); assert.equal("document" in guides.templates[0], false);
    assert.equal((await call("open_project", { projectId: template.id })).isError, undefined);
    const read = (await call("read_project", { projectId: template.id })).structuredContent as { tabId: string };
    const edited = await call("edit_project", { projectId: template.id, expectedTabId: read.tabId, expectedRevision: 0, includeDocument: false,
      commands: [{ type: "rename_slide", slideId: "slide-2", name: "Representative body" }] });
    assert.deepEqual((edited.structuredContent as { warnings: unknown[] }).warnings, []);
    const cloned = await call("clone_project", { templateId: template.id, name: "New content" }); assert.equal(cloned.isError, undefined);
    const clone = cloned.structuredContent as { id: string; editor: { document: { slides: { name: string }[] } } };
    assert.equal(clone.editor.document.slides[0].name, "Representative body");
    assert.deepEqual(projects.get(source.id), before);
    assert.equal((await call("unregister_template", { templateId: template.id })).isError, undefined);
    assert.ok(projects.get(clone.id)); assert.equal(projects.getSummary(clone.id)?.sourceTemplateId, null);
    assert.equal(contentJobRegistry.has(template.id), false);
    const request = (body: unknown, requestOrigin = origin) => new Request(`${origin}/api/content-templates`, {
      method: "POST", headers: { host: "localhost:3000", origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    assert.equal((await POST(request(input, "https://example.com"))).status, 403);
    assert.equal((await POST(request({ ...input, slideIds: [] }))).status, 400);
    assert.equal((await POST(request(input))).status, 201);
    assert.deepEqual(projects.get(source.id), before);
  } finally {
    for (const job of contentJobRegistry.list()) contentJobRegistry.remove(job.id);
    await client.close(); await server.close(); getLocalDatabase().close(); delete process.env.CONTENT_STUDIO_DB_PATH;
    rmSync(directory, { recursive: true, force: true });
  }
});
