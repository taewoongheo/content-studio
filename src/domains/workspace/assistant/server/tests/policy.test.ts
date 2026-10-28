import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { startAssistant, assistantStatus, stopAssistant } from "../service";
import { POST } from "@/app/api/editor-assistant/[tabId]/agent/route";
import type { runCodex } from "@/lib/ai/codex";

test("assistant MCP scopes project access and exposes writes only after an edit intent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "assistant-policy-")), previous = process.env.CONTENT_STUDIO_DB_PATH;
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "db.sqlite");
  const job = contentJobRegistry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English" });
  const target = { projectId: job.id, tabId: job.tabId, projectType: "slideshow" as const };
  let args: Parameters<typeof runCodex>[0] | undefined;
  let release: (() => void) | undefined;
  const fake: typeof runCodex = async input => {
    args = input;
    await new Promise<void>((resolve, reject) => { release = resolve; input.signal.addEventListener("abort", () => reject(input.signal.reason), { once: true }); });
    return { kind: "edit", text: "", suggestion: "" };
  };
  async function call(method: string, params: unknown, token = args?.token) {
    const request = new Request(`http://127.0.0.1:3000/api/editor-assistant/${job.tabId}/agent`, { method: "POST",
      headers: { host: "127.0.0.1:3000", authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const response = await POST(request, { params: Promise.resolve({ tabId: job.tabId }) });
    return response;
  }
  try {
    startAssistant(target, {}, "그림을 키워 줘", randomUUID(), "http://127.0.0.1:3000", fake);
    while (!args) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal((await call("tools/list", {}, "wrong")).status, 403);
    let list = await (await call("tools/list", {})).json();
    for (const name of ["preview_slide", "production_external_references", "production_reference_images", "production_read_images"])
      assert.ok(list.result.tools.some((tool: {name:string}) => tool.name === name));
    assert.ok(!list.result.tools.some((tool: {name:string}) => tool.name === "edit_project"));
    const blocked = await (await call("tools/call", { name: "read_project", arguments: { projectId: "another-project" } })).json();
    assert.equal(blocked.result.isError, true);
    const first = args; release!();
    while (args === first) await new Promise(resolve => setTimeout(resolve, 5));
    list = await (await call("tools/list", {})).json();
    assert.ok(list.result.tools.some((tool: {name:string}) => tool.name === "edit_project"));
    const edited = await (await call("tools/call", { name: "edit_project", arguments: { projectId: job.id, expectedTabId: job.tabId, expectedRevision: 0,
      commands: [{ type: "set_slide_background", slideId: "slide-1", color: "#123456" }] } })).json();
    assert.ok(!edited.result.isError);
    release!();
    for (let n=0;n<100 && assistantStatus(target).state === "running";n++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(assistantStatus(target).state, "failed");
    assert.match(assistantStatus(target).error, /시각 확인/);
    assert.equal(assistantStatus(target).changed, true);
    assert.equal(contentJobRegistry.getRecord(job.id).editorHistory.length, 1);
  } finally {
    stopAssistant(job.tabId); contentJobRegistry.remove(job.id);
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
