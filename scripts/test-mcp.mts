import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import sharp from "sharp";
import type { ContentJobSnapshot } from "../src/lib/content-jobs/domain/types";

type Project = ContentJobSnapshot & { url: string };
const directory = await mkdtemp(join(tmpdir(), "studio-mcp-smoke-"));
const portServer = createServer();
await new Promise<void>((resolve) => portServer.listen(0, "127.0.0.1", resolve));
const address = portServer.address();
if (!address || typeof address === "string") throw new Error("No test port");
const port = address.port;
await new Promise<void>((resolve, reject) => portServer.close((error) => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
let serverLog = "";
function startApp() {
  const child = spawn("pnpm", [process.argv.includes("--production") ? "start" : "dev", "--port", String(port)], {
    env: { ...process.env, CONTENT_STUDIO_DB_PATH: join(directory, "test.sqlite") },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  child.stdout.on("data", (chunk) => { serverLog += chunk; });
  child.stderr.on("data", (chunk) => { serverLog += chunk; });
  return child;
}
let app = startApp();
async function waitForApp() {
  const deadline = Date.now() + 60_000;
  while (true) {
    try { if ((await fetch(`${origin}/mcp`)).status === 405) return; } catch { /* starting */ }
    if (app.exitCode !== null || Date.now() > deadline) throw new Error(`Server did not start: ${serverLog}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}
const stop = () => {
  if (app.pid) {
    try { process.kill(-app.pid, "SIGTERM"); } catch { /* already stopped */ }
  }
};
process.once("SIGINT", stop);
const client = new Client({ name: "studio-smoke", version: "1.0.0" });
try {
  await waitForApp();
  let recovery: Project | undefined;
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  async function call(name: string, args: Record<string, unknown>) {
    const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
    if (result.isError) throw new Error(JSON.stringify(result));
    return result;
  }
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.equal(tools.length, 7);
  assert.equal(tools.includes("add_image"), false);
  console.log("connected", tools);

  // Browser-created drafts and MCP-created drafts must use the same app registry.
  const uiJob = await fetch(`${origin}/api/content-jobs`, {
    method: "POST", headers: { origin },
  }).then((response) => response.json()) as ContentJobSnapshot;
  const readUiJob = (await call("read_project", { projectId: uiJob.id })).structuredContent as Project;
  assert.equal(readUiJob.id, uiJob.id);
  const created = (await call("create_project", { name: "MCP smoke" })).structuredContent as Project;
  const id = created.id;
  const api = await fetch(`${origin}/api/content-jobs/${id}`).then((response) => response.json()) as ContentJobSnapshot;
  assert.equal(api.id, id);

  const browser = await chromium.launch();
  try {
    const listPage = await browser.newPage();
    await listPage.goto(origin);
    await listPage.getByRole("heading", { name: "MCP smoke", exact: true }).waitFor();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.goto(created.url);
    await page.getByRole("button", { name: "ZIP 내보내기" }).waitFor();
    const frame = { x: 0.1, y: 0.2, width: 0.8, height: 0.2 };
    const style = {
      color: "#111111", backgroundColor: "transparent", fontSize: 64, lineHeight: 1.2,
      fontWeight: 700, textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "contain",
    };
    const localPath = join(directory, "image.png");
    await writeFile(localPath, await sharp({ create: {
      width: 60, height: 60, channels: 3, background: "#00FF00",
    } }).png().toBuffer());
    const updated = (await call("edit_project", { projectId: id, expectedRevision: 0, commands: [
      { type: "add_element", element: { id: "title", name: "Title", role: "Main headline", kind: "text", frame, style } },
      { type: "place_element", slideId: "slide-1", elementId: "title", placementId: "title-1" },
      { type: "set_slot_value", slideId: "slide-1", placementId: "title-1", value: "CHEST ROUTINE" },
      { type: "rename_slide", slideId: "slide-1", name: "Live MCP" },
      { type: "add_element", element: { id: "photo", name: "Photo", role: "Exercise image", kind: "image", frame: { ...frame, y: 0.5 }, style } },
      { type: "place_element", slideId: "slide-1", elementId: "photo", placementId: "photo-1" },
      { type: "set_local_image", slideId: "slide-1", placementId: "photo-1", localPath },
      { type: "update_visual", scope: "common", elementId: "title", style: { color: "#FF0000" } },
    ] })).structuredContent as Project;
    await page.getByRole("button", { name: /Live MCP.*선택/ }).waitFor();
    await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
    assert.equal(updated.savedRevision, updated.editor.revision);
    console.log("UI received MCP edit via SSE, revision", updated.editor.revision);
    const preview = await call("preview_slide", { projectId: id, slideId: "slide-1" });
    const png = preview.content.find((content) => content.type === "image");
    assert.ok(png?.type === "image");
    const bytes = Buffer.from(png.data, "base64");
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
    const pixel = await sharp(bytes).extract({ left: 540, top: 800, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
    assert.deepEqual([...pixel], [0, 255, 0], "preview must contain the imported image");
    console.log("preview", meta.width, meta.height, bytes.length);

    const cloned = (await call("create_project", { sourceProjectId: id, name: "Clone" })).structuredContent as Project;
    await listPage.getByRole("heading", { name: "Clone", exact: true }).waitFor();
    assert.notEqual(cloned.id, id);
    assert.equal(cloned.editor.document.slides[0].name, "Live MCP");
    const undone = (await call("undo_project", { projectId: id, expectedRevision: 1 })).structuredContent as Project;
    assert.equal(undone.editor.document.elements.length, 1);
    await page.getByRole("button", { name: /Live MCP.*선택/ }).waitFor({ state: "detached" });
    const read = (await call("read_project", { projectId: cloned.id })).structuredContent as Project;
    assert.equal(read.editor.document.slides[0].name, "Live MCP");
    const save = await fetch(`${origin}/api/content-projects`, {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ jobId: cloned.id, name: "Saved clone" }),
    });
    assert.equal(save.status, 201);
    const opened = (await call("open_project", { projectId: cloned.id })).structuredContent as Project;
    assert.equal(opened.name, "Saved clone");
    await listPage.getByRole("heading", { name: "Saved clone", exact: true }).waitFor();
    recovery = (await call("create_project", { sourceProjectId: cloned.id, name: "Restart recovery" })).structuredContent as Project;
    const listed = (await call("list_projects", {})).structuredContent as { projects: Array<{ id: string }> };
    assert.equal(listed.projects.filter((project) => project.id === cloned.id).length, 1);
    const invalid = await client.callTool({ name: "edit_project", arguments: {
      projectId: id, expectedRevision: 0, commands: [{ type: "rename_slide", slideId: "slide-1", name: "stale" }],
    } });
    assert.equal(invalid.isError, true);
    const denied = await fetch(`${origin}/mcp`, {
      method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: "{}",
    });
    assert.equal(denied.status, 403);
    console.log("PASS autosave status and live project-list refresh");
    console.log("PASS shared memory, clone independence, open/list, undo, revision conflict and cross-origin rejection");
  } finally { await browser.close(); }
  assert.ok(recovery);
  await client.close();
  stop();
  if (app.exitCode === null && app.signalCode === null) await new Promise((resolve) => app.once("exit", resolve));
  serverLog = "";
  app = startApp();
  await waitForApp();
  assert.equal((await fetch(`${origin}/api/content-jobs/${recovery.id}`)).status, 404);
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  const restored = (await call("open_project", { projectId: recovery.id })).structuredContent as Project;
  assert.deepEqual(restored.editor.document, recovery.editor.document);
  assert.equal(restored.assets.length, recovery.assets.length);
  assert.equal(restored.savedRevision, 0);
  assert.equal(restored.name, recovery.name);
  const preview = await call("preview_slide", { projectId: restored.id, slideId: "slide-1" });
  const restoredPng = preview.content.find((item) => item.type === "image");
  assert.ok(restoredPng?.type === "image");
  const restoredPixel = await sharp(Buffer.from(restoredPng.data, "base64"))
    .extract({ left: 540, top: 800, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.deepEqual([...restoredPixel], [0, 255, 0]);
  console.log("PASS real server restart restores the autosaved document and images");
} finally {
  await client.close();
  stop();
  if (app.exitCode === null && app.signalCode === null) await new Promise((resolve) => app.once("exit", resolve));
  process.removeListener("SIGINT", stop);
  await rm(directory, { recursive: true, force: true });
}
