import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import sharp from "sharp";
import type { ContentJobSnapshot } from "../src/lib/content-jobs/domain/types";

const routineGuide = "도입 후 그룹별로 여러 선택지를 함께 보여주고 하나를 선택하도록 안내한다.";

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
  async function seedProject(name: string) {
    const job = await fetch(`${origin}/api/content-jobs`, { method: "POST", headers: { origin } }).then(response => response.json()) as Project;
    const saved = await fetch(`${origin}/api/content-projects`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ jobId: job.id, name }),
    });
    assert.equal(saved.status, 201);
    return (await call("read_project", { projectId: job.id })).structuredContent as Project;
  }
  async function registerTemplate(projectId: string) {
    const result = await call("register_template", { projectId, composition: routineGuide });
    assert.equal((result.structuredContent as { project: { isTemplate: boolean } }).project.isTemplate, true);
  }
  async function cloneTemplate(projectId: string, name: string) {
    await registerTemplate(projectId);
    return (await call("clone_project", { templateProjectId: projectId, name })).structuredContent as Project;
  }
  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.deepEqual([...tools].sort(), [
    "list_projects", "list_template_guides", "set_reuse_guide", "register_template", "unregister_template", "open_project", "clone_project", "read_project",
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
  const emptyGuides = await call("list_template_guides", {});
  assert.deepEqual(emptyGuides.structuredContent, { templates: [] });
  const blocked = CallToolResultSchema.parse(await client.callTool({ name: "clone_project", arguments: { templateProjectId: uiJob.id } }));
  assert.equal(blocked.isError, true);
  const created = await seedProject("MCP smoke");
  const id = created.id;
  const api = await fetch(`${origin}/api/content-jobs/${id}`).then((response) => response.json()) as ContentJobSnapshot;
  assert.equal(api.id, id);

  const browser = await chromium.launch();
  try {
    const listPage = await browser.newPage();
    await listPage.goto(origin);
    const savedColumn = listPage.getByRole("region", { name: "저장된 프로젝트", exact: true });
    const templateColumn = listPage.getByRole("region", { name: "템플릿 프로젝트", exact: true });
    assert.equal(await listPage.getByRole("tab", { name: "저장된 프로젝트", exact: true }).count(), 0);
    await savedColumn.getByRole("button", { name: "MCP smoke 템플릿 지정", exact: true }).click();
    const reuseDialog = listPage.getByRole("dialog");
    await reuseDialog.getByLabel("구성", { exact: true }).fill(routineGuide);
    await reuseDialog.getByRole("button", { name: "저장하고 템플릿 지정", exact: true }).click();
    await reuseDialog.waitFor({ state: "hidden" });
    await templateColumn.getByRole("heading", { name: "MCP smoke", exact: true }).waitFor();
    await savedColumn.getByRole("button", { name: "템플릿 지정됨", exact: true }).waitFor();
    const registeredGuides = (await call("list_template_guides", {})).structuredContent as { templates: Array<{ id: string; composition: string }> };
    assert.equal(registeredGuides.templates[0].id, id);
    assert.deepEqual(registeredGuides.templates[0].composition, routineGuide);
    await listPage.setViewportSize({ width: 1440, height: 1000 });
    const leftBounds = await templateColumn.boundingBox();
    const rightBounds = await savedColumn.boundingBox();
    assert.ok(leftBounds && rightBounds && leftBounds.x < rightBounds.x && Math.abs(leftBounds.y - rightBounds.y) < 2);
    await listPage.screenshot({ path: "/tmp/content-studio-template-columns-desktop.png", fullPage: true });
    await listPage.setViewportSize({ width: 390, height: 844 });
    assert.ok(await listPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "mobile page must not scroll horizontally");
    await listPage.screenshot({ path: "/tmp/content-studio-template-columns-mobile.png", fullPage: true });
    await listPage.setViewportSize({ width: 1440, height: 1000 });
    await templateColumn.getByRole("button", { name: "MCP smoke 템플릿 해제", exact: true }).click();
    await templateColumn.getByRole("heading", { name: "MCP smoke", exact: true }).waitFor({ state: "detached" });
    await savedColumn.getByRole("heading", { name: "MCP smoke", exact: true }).waitFor();
    // An existing guide makes subsequent designation a single click without a dialog.
    await savedColumn.getByRole("button", { name: "MCP smoke 템플릿 지정", exact: true }).click();
    await templateColumn.getByRole("heading", { name: "MCP smoke", exact: true }).waitFor();
    assert.equal(await listPage.getByRole("dialog").count(), 0);
    console.log("PASS two-column template dashboard, atomic guide/designation, direct designation/unregister and mobile layout");
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

    const cloned = await cloneTemplate(id, "Clone");
    await savedColumn.getByRole("heading", { name: "Clone", exact: true }).waitFor();
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
    await savedColumn.getByRole("heading", { name: "Saved clone", exact: true }).waitFor();
    recovery = await cloneTemplate(cloned.id, "Restart recovery");
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
    const colorProject = await seedProject("Partial colors");
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
    const colorClone = await cloneTemplate(colorProject.id, "Colored clone");
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
    await page.getByRole("button", { name: "Colored clone 탭 닫기", exact: true }).waitFor({ state: "detached" });
    await listPage.getByRole("heading", { name: "템플릿 프로젝트", exact: true, level: 1 }).waitFor();
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

    // An untouched new editor stays temporary; edits autosave and navigation flushes immediately.
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
    await blankTab.waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(blankId), true, "closing persists a changed project name");

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

    const automatic = await newBlank();
    await page.getByRole("button", { name: "텍스트 추가", exact: true }).click();
    await page.getByLabel("내용", { exact: true }).fill("AUTOSAVE AFTER FIVE SECONDS");
    assert.equal((await savedIds()).includes(automatic.id), false);
    await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
    assert.equal((await savedIds()).includes(automatic.id), true);
    await page.getByLabel("내용", { exact: true }).fill("CTRL S FLUSHES PENDING TEXT");
    await page.getByLabel("내용", { exact: true }).press("Control+s");
    await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
    const keyboardSaved = (await call("read_project", { projectId: automatic.id })).structuredContent as Project;
    assert.equal(keyboardSaved.savedRevision, keyboardSaved.editor.revision);
    assert.ok(keyboardSaved.editor.document.slides[0].placements.some(p => p.value === "CTRL S FLUSHES PENDING TEXT"));
    await page.getByLabel("내용", { exact: true }).fill("CMD S ALSO SAVES");
    await page.getByLabel("내용", { exact: true }).press("Meta+s");
    await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
    const metaSaved = (await call("read_project", { projectId: automatic.id })).structuredContent as Project;
    assert.ok(metaSaved.editor.document.slides[0].placements.some(p => p.value === "CMD S ALSO SAVES"));
    assert.equal(metaSaved.savedRevision, metaSaved.editor.revision);
    console.log("PASS five-second UI autosave and Ctrl+S/Cmd+S flush input before persistence");

    const temporary = await newBlank();
    await page.getByRole("button", { name: "슬라이드 배경 선택", exact: true }).click();
    await page.getByLabel("슬라이드 배경색", { exact: true }).fill("#456789");
    await tabBar.locator(`[data-project-tab="${temporary.tabId}"]`).getByRole("button", { name: /탭 닫기$/ }).click();
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
    await savedColumn.getByRole("heading", { name: "Saved renamed", exact: true }).waitFor();
    await page.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "삭제", exact: true }).click();
    await tabBar.locator(`[data-project-tab="${savedTemporary.tabId}"]`).waitFor({ state: "detached" });
    assert.equal((await savedIds()).includes(temporary.id), false);
    await savedColumn.getByRole("heading", { name: "Saved renamed", exact: true }).waitFor({ state: "detached" });

    const listDelete = await seedProject("Delete from list");
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
    console.log("PASS rename, temporary drafts, immediate save on close, header/list deletion and canvas/tab layout");

    // Malformed mutation bodies are client errors and must not alter a project.
    for (const [path, method] of [
      [`/api/content-jobs/${colorProject.id}`, "DELETE"],
      [`/api/content-projects/${colorProject.id}`, "PATCH"],
      [`/api/content-projects/${colorProject.id}`, "DELETE"],
    ]) {
      for (const body of [null, [], "invalid", 12]) {
        const response = await fetch(`${origin}${path}`, { method,
          headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        assert.equal(response.status, 400);
      }
    }

    // The dashboard delegates a single project load to the workspace.
    await tabBar.getByRole("button", { name: "대시보드", exact: true }).click();
    await page.getByRole("heading", { name: "템플릿 프로젝트", exact: true, level: 1 }).waitFor();
    let openRequests = 0;
    page.on("request", request => {
      if (request.method() === "POST" && request.url().endsWith(`/api/content-projects/${colorProject.id}`)) openRequests++;
    });
    await page.getByRole("region", { name: "저장된 프로젝트", exact: true }).getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Partial colors", exact: true }) })
      .getByRole("button", { name: "열기", exact: true }).click();
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();
    assert.equal(openRequests, 1);

    // A new edit arriving while the first explicit flush is in flight must also be sent.
    await page.getByRole("button", { name: "Color title Element 선택", exact: true }).click();
    const editUrl = `${origin}/api/content-jobs/${colorProject.id}`;
    let releaseEdit!: () => void;
    let editStarted!: () => void;
    const editGate = new Promise<void>(resolve => { releaseEdit = resolve; });
    const editSeen = new Promise<void>(resolve => { editStarted = resolve; });
    let interceptedEdits = 0;
    await page.route(editUrl, async route => {
      if (route.request().method() !== "POST") return route.continue();
      interceptedEdits++;
      if (interceptedEdits === 1) { editStarted(); await editGate; }
      await route.continue();
    });
    await page.getByLabel("이름", { exact: true }).fill("First during flush");
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    await editSeen;
    await page.getByLabel("이름", { exact: true }).fill("Latest during flush");
    releaseEdit();
    await page.locator(`[data-tab-id="${reopenedClone.tabId}"]`).waitFor();
    await page.unroute(editUrl);
    const flushedName = (await call("read_project", { projectId: colorProject.id })).structuredContent as Project;
    assert.equal(flushedName.editor.document.elements.find(element => element.id === "color-title")?.name, "Latest during flush");
    assert.equal(interceptedEdits, 2);
    await tabBar.getByRole("button", { name: "Partial colors", exact: true }).click();
    await page.locator(`[data-tab-id="${colorProject.tabId}"]`).waitFor();

    // Failed queued commands stop the switch and leave the editor available for retry.
    let releaseFailedCommand!: () => void;
    let failedCommandStarted!: () => void;
    const failedCommandGate = new Promise<void>(resolve => { releaseFailedCommand = resolve; });
    const failedCommandSeen = new Promise<void>(resolve => { failedCommandStarted = resolve; });
    await page.route(editUrl, async route => {
      if (route.request().method() !== "POST") return route.continue();
      failedCommandStarted(); await failedCommandGate;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Injected command failure" }) });
    });
    await page.getByLabel("화면 비율", { exact: true }).selectOption("1:1");
    await failedCommandSeen;
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    releaseFailedCommand();
    await page.getByText("입력 중인 변경을 반영하지 못했습니다. 현재 탭을 확인해 주세요.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("job"), colorProject.id);
    await page.unroute(editUrl);
    const retryResponse = page.waitForResponse(response => response.url() === editUrl && response.request().method() === "POST");
    await page.getByLabel("화면 비율", { exact: true }).selectOption("1:1");
    assert.equal((await retryResponse).status(), 200);

    // A failed in-flight image operation must also prevent switching away.
    const assetUrl = `${editUrl}/assets`;
    let releaseImage!: () => void;
    let imageStarted!: () => void;
    const imageGate = new Promise<void>(resolve => { releaseImage = resolve; });
    const imageSeen = new Promise<void>(resolve => { imageStarted = resolve; });
    await page.route(assetUrl, async route => {
      imageStarted(); await imageGate;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Injected image failure" }) });
    });
    const imageBytes = [...await readFile(localPath)];
    await page.locator('div[aria-label$="슬라이드 미리보기"]').evaluate((element, bytes) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], "test.png", { type: "image/png" }));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
    }, imageBytes);
    await imageSeen;
    await tabBar.getByRole("button", { name: "Colored clone", exact: true }).click();
    releaseImage();
    await page.getByText("입력 중인 변경을 반영하지 못했습니다. 현재 탭을 확인해 주세요.", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("job"), colorProject.id);
    await page.unroute(assetUrl);
    console.log("PASS malformed JSON, one dashboard load, newer input during flush and failed command/image switch guards");

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
