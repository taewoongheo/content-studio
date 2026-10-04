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
    if ((name === "edit_project" || name === "undo_project") && !args.expectedTabId) {
      const current = await fetch(`${origin}/api/content-jobs/${args.projectId}`).then(response => response.json()) as Project;
      args = { ...args, expectedTabId: current.tabId };
    }
    const result = CallToolResultSchema.parse(await client.callTool({ name, arguments: args }));
    if (result.isError) throw new Error(JSON.stringify(result));
    return result;
  }
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.deepEqual([...tools].sort(), [
    "list_projects", "open_project", "create_project", "read_project",
    "edit_project", "undo_project", "preview_slide",
  ].sort(), "MCP must expose only the supported tools, without project deletion or tab close");
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
    page.on("pageerror", error => console.error("Browser error", error.message));
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
    const updated = (await call("edit_project", { projectId: id, expectedTabId: created.tabId, expectedRevision: 0, commands: [
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
      projectId: id, expectedTabId: created.tabId, expectedRevision: 0, commands: [{ type: "rename_slide", slideId: "slide-1", name: "stale" }],
    } });
    assert.equal(invalid.isError, true);
    const denied = await fetch(`${origin}/mcp`, {
      method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: "{}",
    });
    assert.equal(denied.status, 403);
    const colorProject = (await call("create_project", { name: "Partial colors" })).structuredContent as Project;
    const colorText = "BUILD A BIGGER\nCHEST ROUTINE";
    const colorStart = colorText.indexOf("CHEST");
    await call("edit_project", { projectId: colorProject.id, expectedRevision: 0, commands: [
      { type: "add_element", element: { id: "color-title", name: "Color title", role: "Hook", kind: "text",
        frame: { x: 0.1, y: 0.15, width: 0.8, height: 0.5 }, style: { ...style, fontSize: 150, color: "#000000" } } },
      { type: "place_element", slideId: "slide-1", elementId: "color-title", placementId: "color-title-1" },
      { type: "set_slot_value", slideId: "slide-1", placementId: "color-title-1", value: colorText },
    ] });
    const beforeColors = await call("preview_slide", { projectId: colorProject.id, slideId: "slide-1" });
    await page.goto(`${origin}/?job=${colorProject.id}`);
    await page.getByRole("button", { name: "Color title Element 선택 및 레이어 순서 이동", exact: true }).click();
    const content = page.getByLabel("내용", { exact: true });
    await content.evaluate((input, start) => {
      const textarea = input as HTMLTextAreaElement;
      textarea.focus(); textarea.setSelectionRange(start, start);
    }, colorStart);
    for (let i = 0; i < 5; i++) await content.press("Shift+ArrowRight");
    const applied = page.waitForResponse(response => response.url().endsWith(`/api/content-jobs/${colorProject.id}`)
      && response.request().method() === "POST");
    await page.getByRole("button", { name: "선택 색상 적용", exact: true }).click();
    assert.equal((await applied).status(), 200);
    const colored = (await call("read_project", { projectId: colorProject.id })).structuredContent as Project;
    assert.deepEqual(colored.editor.document.slides[0].placements.find(p => p.id === "color-title-1")?.textColors,
      [{ start: colorStart, end: colorStart + 5, color: "#FF0000" }]);
    const afterColors = await call("preview_slide", { projectId: colorProject.id, slideId: "slide-1" });
    async function pixels(result: Awaited<ReturnType<typeof call>>) {
      const image = result.content.find(item => item.type === "image");
      assert.ok(image?.type === "image");
      return sharp(Buffer.from(image.data, "base64")).removeAlpha().raw().toBuffer();
    }
    const beforePixels = await pixels(beforeColors), afterPixels = await pixels(afterColors);
    const ink = (data: Buffer) => Buffer.from(Array.from({ length: data.length / 3 }, (_, i) =>
      Math.min(data[i * 3], data[i * 3 + 1], data[i * 3 + 2])));
    assert.deepEqual(ink(afterPixels), ink(beforePixels), "color changes must preserve glyph positions, wrapping and alignment");
    assert.ok(afterPixels.some((value, i) => i % 3 === 0 && value > 200 && afterPixels[i + 1] < 30), "selected word must contain red ink");
    const colorClone = (await call("create_project", { sourceProjectId: colorProject.id, name: "Colored clone" })).structuredContent as Project;
    assert.deepEqual(colorClone.editor.document, colored.editor.document);
    const colorUndo = (await call("undo_project", { projectId: colorProject.id, expectedRevision: colored.editor.revision })).structuredContent as Project;
    assert.equal(colorUndo.editor.document.slides[0].placements.find(p => p.id === "color-title-1")?.textColors, undefined);
    const invalidColor = await client.callTool({ name: "edit_project", arguments: { projectId: colorProject.id,
      expectedTabId: colorUndo.tabId, expectedRevision: colorUndo.editor.revision, commands: [{ type: "set_text_colors", slideId: "slide-1", placementId: "color-title-1",
        textColors: [{ start: 0, end: 1000, color: "#FF0000" }] }] } });
    assert.equal(invalidColor.isError, true);
    const afterInvalidColor = (await call("read_project", { projectId: colorProject.id })).structuredContent as Project;
    assert.deepEqual(afterInvalidColor.editor.document, colorUndo.editor.document);
    let colorRevision = colorUndo.editor.revision;
    for (const textAlign of ["left", "right"]) {
      const wrappedText = "AVATAR VERYLONGWORDWITHOUTSPACES\nCHEST ROUTINE";
      const plain = (await call("edit_project", { projectId: colorProject.id, expectedRevision: colorRevision, commands: [
        { type: "update_visual", scope: "local", slideId: "slide-1", placementId: "color-title-1",
          frame: { x: 0.1, y: 0.15, width: 0.4, height: 0.7 }, style: { textAlign } },
        { type: "set_slot_value", slideId: "slide-1", placementId: "color-title-1", value: wrappedText, textColors: [] },
      ] })).structuredContent as Project;
      const plainPreview = await pixels(await call("preview_slide", { projectId: colorProject.id, slideId: "slide-1" }));
      const ranged = (await call("edit_project", { projectId: colorProject.id, expectedRevision: plain.editor.revision, commands: [
        { type: "set_text_colors", slideId: "slide-1", placementId: "color-title-1",
          textColors: [{ start: 2, end: wrappedText.length - 2, color: "#FF0000" }] },
      ] })).structuredContent as Project;
      const rangedPreview = await pixels(await call("preview_slide", { projectId: colorProject.id, slideId: "slide-1" }));
      assert.deepEqual(ink(rangedPreview), ink(plainPreview), `${textAlign} alignment and forced word wrapping must preserve glyph layout`);
      colorRevision = ranged.editor.revision;
    }
    console.log("PASS selected text color UI, exact glyph-layout preservation, clone, undo and invalid ranges");

    const tabBar = page.getByRole("navigation", { name: "프로젝트 탭", exact: true });
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("job") === colorClone.id);
    await page.locator(`[data-tab-id="${colorClone.tabId}"]`).waitFor();
    let editRequests = 0;
    page.on("request", request => {
      if (request.method() === "POST" && request.url().endsWith(`/api/content-jobs/${colorClone.id}`)) editRequests++;
    });
    await page.getByLabel("내용", { exact: true }).fill("FAST SWITCH");
    await tabBar.getByRole("button", { name: "Partial colors", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("job") === colorProject.id);
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();
    const switchedClone = (await call("read_project", { projectId: colorClone.id })).structuredContent as Project;
    assert.equal(switchedClone.editor.document.slides[0].placements.find(p => p.id === "color-title-1")?.value, "FAST SWITCH");
    assert.equal(editRequests, 1, "flush and debounce must share one edit request");
    await page.getByRole("button", { name: "슬라이드 배경 선택", exact: true }).click();
    await page.getByLabel("슬라이드 배경색", { exact: true }).fill("#123456");
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("job") === colorClone.id);
    await page.locator(`[data-tab-id="${colorClone.tabId}"]`).waitFor();
    const switchedBackground = (await call("read_project", { projectId: colorProject.id })).structuredContent as Project;
    assert.equal(switchedBackground.editor.document.slides[0].backgroundColor, "#123456");
    await page.getByRole("button", { name: /^2장 .*선택 및 순서 이동$/ }).click();
    await page.getByRole("checkbox", { name: "가이드", exact: true }).uncheck();
    await tabBar.getByRole("button", { name: "Partial colors", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("job") === colorProject.id);
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("job") === colorClone.id);
    await page.locator(`[data-tab-id="${colorClone.tabId}"]`).waitFor();
    assert.equal(await page.getByRole("checkbox", { name: "가이드", exact: true }).isChecked(), false);
    assert.equal(await page.getByRole("button", { name: /^2장 .*선택 및 순서 이동$/ }).getAttribute("aria-current"), "page");
    await page.getByRole("button", { name: "새 탭", exact: true }).click();
    await writeFile("/tmp/content-studio-new-tab.png", await page.getByRole("dialog").screenshot());
    await page.getByRole("dialog").getByRole("button", { name: /Colored clone/ }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const openTabs = await fetch(`${origin}/api/content-jobs`).then(response => response.json()) as Array<{ projectId: string }>;
    assert.equal(openTabs.filter(tab => tab.projectId === colorClone.id).length, 1);
    await listPage.getByRole("navigation", { name: "프로젝트 탭" }).getByRole("button", { name: "Colored clone", exact: true }).click();
    await listPage.waitForURL(url => url.searchParams.get("job") === colorClone.id);
    await page.getByRole("button", { name: "Colored clone 탭 닫기", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "저장 후 종료", exact: true }).click();
    await page.getByRole("button", { name: "Colored clone 탭 닫기", exact: true }).waitFor({ state: "detached" });
    await listPage.getByRole("heading", { name: "저장된 프로젝트", exact: true }).waitFor();
    assert.equal((await fetch(`${origin}/api/content-jobs/${colorClone.id}`)).status, 404);
    const closedEdit = await client.callTool({ name: "edit_project", arguments: { projectId: colorClone.id,
      expectedTabId: colorClone.tabId, expectedRevision: switchedClone.editor.revision,
      commands: [{ type: "rename_slide", slideId: "slide-1", name: "Closed" }] } });
    assert.equal(closedEdit.isError, true);
    const reopenedClone = (await call("open_project", { projectId: colorClone.id })).structuredContent as Project;
    assert.notEqual(reopenedClone.tabId, colorClone.tabId);
    assert.deepEqual(reopenedClone.editor.document, switchedClone.editor.document);
    const staleTabEdit = await client.callTool({ name: "edit_project", arguments: { projectId: colorClone.id,
      expectedTabId: colorClone.tabId, expectedRevision: 0,
      commands: [{ type: "rename_slide", slideId: "slide-1", name: "Old tab" }] } });
    assert.equal(staleTabEdit.isError, true);
    await page.getByRole("button", { name: "새 탭", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "새 편집기 시작", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "ZIP 내보내기" }).waitFor();
    const blankId = new URL(page.url()).searchParams.get("job");
    assert.ok(blankId && blankId !== colorClone.id);
    const blankJob = await fetch(`${origin}/api/content-jobs/${blankId}`).then(response => response.json()) as Project;
    await page.locator(`[data-tab-id="${blankJob.tabId}"]`).waitFor();
    await page.goBack();
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();
    await page.goForward();
    await page.locator(`[data-tab-id="${blankJob.tabId}"]`).waitFor();
    await writeFile("/tmp/content-studio-project-tabs.png", await page.screenshot({ fullPage: true }));
    console.log("PASS global tabs, chooser reuse, text/background flush, view restoration, two-browser close and stale-tab rejection");

    // A new editor is temporary until explicitly saved (or mutated through MCP).
    async function savedIds() {
      return (await fetch(`${origin}/api/content-projects`).then(response => response.json()) as Array<{ id: string }>).map(project => project.id);
    }
    const blankTab = tabBar.locator(`[data-project-tab="${blankJob.tabId}"]`);
    await blankTab.getByRole("button", { name: /이름 변경$/ }).click();
    await page.getByRole("dialog").getByLabel("프로젝트 이름", { exact: true }).fill("Temporary renamed");
    await page.getByRole("dialog").getByRole("button", { name: "이름 변경", exact: true }).click();
    await blankTab.getByRole("button", { name: "Temporary renamed", exact: true }).waitFor();
    assert.equal((await savedIds()).includes(blankId), false);
    await blankTab.getByRole("button", { name: /탭 닫기$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "취소", exact: true }).click();
    assert.equal((await fetch(`${origin}/api/content-jobs/${blankId}`)).status, 200);
    await blankTab.getByRole("button", { name: /탭 닫기$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "저장하지 않고 종료", exact: true }).click();
    await blankTab.waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(blankId), false);

    async function newBlank() {
      await tabBar.getByRole("button", { name: "새 탭", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "새 편집기 시작", exact: true }).click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.getByRole("button", { name: "ZIP 내보내기" }).waitFor();
      const projectId = new URL(page.url()).searchParams.get("job")!;
      const project = await fetch(`${origin}/api/content-jobs/${projectId}`).then(response => response.json()) as Project;
      await page.locator(`[data-tab-id="${project.tabId}"]`).waitFor();
      return project;
    }
    const untouched = await newBlank();
    await tabBar.locator(`[data-project-tab="${untouched.tabId}"]`).getByRole("button", { name: /탭 닫기$/ }).click();
    await tabBar.locator(`[data-project-tab="${untouched.tabId}"]`).waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(untouched.id), false);
    assert.equal(await page.getByRole("dialog").count(), 0);

    const temporary = await newBlank();
    await page.getByRole("button", { name: "슬라이드 배경 선택", exact: true }).click();
    await page.getByLabel("슬라이드 배경색", { exact: true }).fill("#456789");
    await tabBar.locator(`[data-project-tab="${temporary.tabId}"]`).getByRole("button", { name: /탭 닫기$/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "저장 후 종료", exact: true }).click();
    await tabBar.locator(`[data-project-tab="${temporary.tabId}"]`).waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(temporary.id), true);
    const savedTemporary = (await call("open_project", { projectId: temporary.id })).structuredContent as Project;
    assert.equal(savedTemporary.editor.document.slides[0].backgroundColor, "#456789");
    await tabBar.locator(`[data-project-tab="${savedTemporary.tabId}"]`).getByRole("button", { name: "새 프로젝트", exact: true }).click();
    await page.locator(`[data-tab-id="${savedTemporary.tabId}"]`).waitFor();
    await tabBar.locator(`[data-project-tab="${savedTemporary.tabId}"]`).getByRole("button", { name: /이름 변경$/ }).click();
    await page.getByRole("dialog").getByLabel("프로젝트 이름", { exact: true }).fill("Saved renamed");
    await page.getByRole("dialog").getByRole("button", { name: "이름 변경", exact: true }).click();
    await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
    await listPage.getByRole("heading", { name: "Saved renamed", exact: true }).waitFor();
    await page.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
    await tabBar.locator(`[data-project-tab="${savedTemporary.tabId}"]`).waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(temporary.id), false);
    await listPage.getByRole("heading", { name: "Saved renamed", exact: true }).waitFor({ state: "detached" });

    const listDelete = (await call("create_project", { name: "Delete from list" })).structuredContent as Project;
    await listPage.getByRole("button", { name: "Delete from list 프로젝트 삭제", exact: true }).click();
    await listPage.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
    await tabBar.locator(`[data-project-tab="${listDelete.tabId}"]`).waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(listDelete.id), false);
    assert.equal((await fetch(`${origin}/api/content-jobs/${listDelete.id}`)).status, 404);
    await tabBar.getByRole("button", { name: "Partial colors", exact: true }).click();
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();
    const pageControls = await page.getByRole("navigation", { name: "페이지 선택", exact: true }).boundingBox();
    const canvas = await page.locator('div[aria-label$="슬라이드 미리보기"]').boundingBox();
    assert.ok(pageControls && canvas && pageControls.y >= canvas.y + canvas.height, "page controls must sit below the canvas");
    await tabBar.getByRole("button", { name: "새 탭", exact: true }).scrollIntoViewIfNeeded();
    const lastTab = await tabBar.locator("[data-project-tab]").last().boundingBox();
    const plus = await tabBar.getByRole("button", { name: "새 탭", exact: true }).boundingBox();
    assert.ok(lastTab && plus && plus.x - (lastTab.x + lastTab.width) <= 8, "plus belongs immediately after the last tab");
    await writeFile("/tmp/content-studio-project-tabs.png", await page.screenshot({ fullPage: true }));
    console.log("PASS rename, temporary drafts, cancel/save/discard close, header/list deletion and canvas/tab layout");

    console.log("PASS autosave status and live project-list refresh");
    console.log("PASS shared memory, clone independence, open/list, undo, revision conflict and cross-origin rejection");
  } catch (error) {
    const pages = browser.contexts().flatMap(context => context.pages());
    for (const [index, failedPage] of pages.entries()) {
      console.log("failed page", index, await failedPage.locator("body").innerText());
      await failedPage.screenshot({ path: `/tmp/studio-tabs-failure-${index}.png` });
    }
    throw error;
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
