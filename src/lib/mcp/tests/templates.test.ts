import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createStudioMcpServer } from "../server";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { createContentProject, saveContentProject } from "@/lib/content-jobs/projects/service";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { PATCH } from "@/app/api/content-projects/[projectId]/reuse/route";

const origin = "http://localhost:3000";
const guide = (description = "Introduction followed by grouped alternatives and a choose-one prompt") => description;

test("MCP는 가이드 목록만 제공하고 빈 생성·미등록 복제를 차단하며 대시보드 등록과 같은 원본을 사용한다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-template-mcp-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "db.sqlite");
  const client = new Client({ name: "template-test", version: "1.0" });
  const server = createStudioMcpServer(origin);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const names = (await client.listTools()).tools.map(tool => tool.name);
    assert.equal(names.includes("create_project"), false);
    assert.ok(names.includes("clone_project"));
    assert.ok(names.includes("register_template"));
    assert.ok(names.includes("unregister_template"));
    assert.deepEqual((await client.callTool({ name: "list_template_guides", arguments: {} })).structuredContent, { templates: [] });
    assert.equal((await client.callTool({ name: "clone_project", arguments: {} })).isError, true);
    const source = createContentProject(contentJobRegistry, { name: "Back routine" });
    saveContentProject(contentJobRegistry, source.id, "Back routine");
    const projects = new ContentProjectStore(getLocalDatabase());
    const original = projects.get(source.id)!;
    const register = (projectId: string, composition?: unknown) => client.callTool({ name: "register_template", arguments: { projectId, ...(composition === undefined ? {} : { composition }) } });
    const unregister = (projectId: string) => client.callTool({ name: "unregister_template", arguments: { projectId } });
    assert.equal((await register("missing", guide())).isError, true);
    assert.equal((await unregister("missing")).isError, true);
    assert.equal((await register(source.id)).isError, true);
    assert.equal((await register(source.id, "   ")).isError, true);
    assert.equal((await register(source.id, { contentRole: "Routine" })).isError, true);
    assert.equal((await register(source.id, {})).isError, true);
    assert.equal((await register(source.id, null)).isError, true);
    assert.equal((await register(source.id, guide("x".repeat(2001)))).isError, true);
    assert.equal(projects.getSummary(source.id)?.isTemplate, false);
    assert.equal(projects.getSummary(source.id)?.composition, "");
    assert.equal((await register(source.id, ` ${guide()} `)).isError, undefined);
    assert.deepEqual(projects.getSummary(source.id)?.composition, guide());
    assert.equal((await register(source.id)).isError, undefined);
    assert.equal(projects.list().length, 1);
    assert.deepEqual(projects.get(source.id)?.document, original.document);
    assert.deepEqual(projects.get(source.id)?.assets, original.assets);
    assert.equal((await unregister(source.id)).isError, undefined);
    assert.equal((await unregister(source.id)).isError, undefined);
    assert.deepEqual(projects.getSummary(source.id)?.composition, guide());
    assert.deepEqual((await client.callTool({ name: "list_template_guides", arguments: {} })).structuredContent, { templates: [] });
    assert.equal((await register(source.id)).isError, undefined);
    assert.equal(projects.listTemplates()[0].id, source.id);
    assert.equal((await unregister(source.id)).isError, undefined);
    assert.equal((await client.callTool({ name: "set_reuse_guide", arguments: { projectId: source.id, composition: "" } })).isError, undefined);
    assert.equal((await client.callTool({ name: "clone_project", arguments: { templateProjectId: source.id } })).isError, true);
    const context = { params: Promise.resolve({ projectId: source.id }) };
    const patch = (body: unknown, requestOrigin = origin) => PATCH(new Request(`${origin}/api/content-projects/${source.id}/reuse`, {
      method: "PATCH", headers: { host: "localhost:3000", origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(body),
    }), context);
    assert.equal((await PATCH(new Request(`${origin}/api/content-projects/missing/reuse`, {
      method: "PATCH", headers: { host: "localhost:3000", origin, "content-type": "application/json" },
      body: JSON.stringify({ composition: guide() }),
    }), { params: Promise.resolve({ projectId: "missing" }) })).status, 404);
    assert.equal((await patch({ isTemplate: true })).status, 422);
    assert.equal((await patch({ composition: null })).status, 400);
    assert.equal((await patch({ composition: { contentRole: "Routine" } })).status, 400);
    assert.equal((await patch({ composition: " ", isTemplate: true })).status, 422);
    assert.equal(projects.getSummary(source.id)?.isTemplate, false);
    assert.equal((await patch({ composition: guide("Exercise cards"), isTemplate: true }, "https://example.com")).status, 403);
    assert.equal((await patch({ composition: guide("Exercise cards"), isTemplate: true })).status, 200);
    assert.equal((await patch({ composition: " " })).status, 422);
    assert.equal(projects.getSummary(source.id)?.composition, guide("Exercise cards"));
    const guides = (await client.callTool({ name: "list_template_guides", arguments: {} })).structuredContent as { templates: Array<Record<string, unknown>> };
    assert.equal(guides.templates.length, 1);
    assert.equal(guides.templates[0].id, source.id);
    assert.deepEqual(guides.templates[0].composition, guide("Exercise cards"));
    assert.equal("editor" in guides.templates[0], false);
    assert.equal("document" in guides.templates[0], false);
    assert.equal("assets" in guides.templates[0], false);
    assert.equal((await client.callTool({ name: "set_reuse_guide", arguments: { projectId: source.id, composition: guide("Updated routine guide") } })).isError, undefined);
    assert.equal((await client.callTool({ name: "set_reuse_guide", arguments: { projectId: source.id, composition: "" } })).isError, true);
    const cloned = await client.callTool({ name: "clone_project", arguments: { templateProjectId: source.id, name: "Chest" } });
    assert.equal(cloned.isError, undefined);
    assert.equal(projects.list().length, 2);
    assert.equal(projects.listTemplates().length, 1);
    const clonedProject = projects.get((cloned.structuredContent as { id: string }).id);
    assert.equal((await unregister(source.id)).isError, undefined);
    assert.deepEqual(projects.get(clonedProject!.id), clonedProject);
    assert.deepEqual(projects.get(source.id)?.document, original.document);
    assert.deepEqual(projects.getSummary(source.id)?.composition, guide("Updated routine guide"));
    assert.equal((await client.callTool({ name: "clone_project", arguments: { templateProjectId: source.id } })).isError, true);
    assert.equal((await register(source.id)).isError, undefined);
    assert.equal((await patch({ isTemplate: false })).status, 200);
    assert.equal((await client.callTool({ name: "clone_project", arguments: { templateProjectId: source.id } })).isError, true);
    assert.ok(projects.get(source.id));
  } finally {
    await client.close(); await server.close();
    getLocalDatabase().close(); delete process.env.CONTENT_STUDIO_DB_PATH;
    rmSync(directory, { recursive: true, force: true });
  }
});
