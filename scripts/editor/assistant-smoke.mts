import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AssistantState } from "../../src/domains/workspace/assistant/model";

/** Real editor UI and existing undo endpoints; intercepted AI requests never run a paid model. */
export async function verifyEditorAssistant(browser: Browser, origin: string) {
  const client = new Client({ name: "assistant-smoke", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return result.structuredContent as Record<string, unknown>;
  }
  const idle: AssistantState = { state: "idle", phase: "", text: "", suggestion: "", error: "", changed: false };
  const states = new Map<string, AssistantState>();
  const submitted: Array<Record<string, unknown>> = [];
  await page.route("**/api/editor-assistant*", async route => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: states.get(new URL(req.url()).searchParams.get("tabId")!) ?? idle });
    const body = req.postDataJSON(); submitted.push(body);
    const state: AssistantState = body.action === "stop" ? { ...idle, state: "stopped" }
      : body.message.includes("어때") ? { ...idle, state: "completed", requestId: body.requestId, text: "제목을 조금 키우면 읽기 좋습니다.", suggestion: "제목을 키워 줘" }
        : { ...idle, state: "running", requestId: body.requestId, command: body.message, phase: "수정·시각 확인 중" };
    states.set(body.tabId, state); return route.fulfill({ json: state });
  });
  try {
    for (const type of ["slideshow", "video"] as const) {
      const created = await call(type === "slideshow" ? "create_project" : "create_video_project", type === "slideshow"
        ? { name: "Assistant slides", topic: "Test", message: "Test", content_type: "Test", slideCount: 1 } : { name: "Assistant video" });
      const id = String(created.id), tabId = String(created.tabId);
      await page.goto(`${origin}/?job=${id}&type=${type}`);
      await page.locator(`[data-tab-id="${tabId}"]`).waitFor();
      await page.getByRole("button", { name: "AI 명령 열기" }).click();
      const dialog = page.getByRole("dialog", { name: "에디터 AI 명령" });
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /게시글 전체/);
      await page.screenshot({ path: `/tmp/content-studio-assistant-${type}.png` });
      await dialog.getByLabel("AI 편집 명령").fill("지금 구성 어때?");
      await dialog.getByRole("button", { name: "실행", exact: true }).click();
      await dialog.getByText("제목을 조금 키우면 읽기 좋습니다.").waitFor();
      await dialog.getByRole("button", { name: "제안 적용" }).click();
      await dialog.getByRole("button", { name: "중단", exact: true }).waitFor();
      assert.equal(submitted.at(-1)?.message, "제목을 키워 줘");
      assert.equal(await dialog.getByLabel("AI 편집 명령").inputValue(), "제목을 키워 줘");
      assert.ok(await dialog.getByLabel("AI 편집 명령").isDisabled());
      await dialog.getByRole("status").getByText("작업 중", { exact: true }).waitFor();
      await dialog.getByRole("button", { name: "AI 명령 닫기" }).click();
      assert.equal(states.get(tabId)?.state, "running", "closing the panel must not stop a command");
      // An actual existing edit endpoint represents the AI tool write, preserving undo.
      if (type === "slideshow") {
        const current = await call("read_project", { projectId: id });
        await call("edit_project", { projectId: id, expectedTabId: tabId, expectedRevision: (current.editor as {revision:number}).revision,
          commands: [{ type: "set_slide_background", slideId: "slide-1", color: "#123456" }] });
      } else {
        const current = await call("read_video_project", { projectId: id });
        await call("edit_video_project", { projectId: id, expectedTabId: tabId, expectedRevision: current.revision,
          commands: [{ type: "set_document", changes: { backgroundColor: "#123456" } }] });
      }
      states.set(tabId, { ...states.get(tabId)!, state: "completed", phase: "완료", changed: true });
      await page.getByRole("button", { name: "AI 명령 열기" }).click();
      await dialog.getByText("완료", { exact: true }).waitFor();
      assert.ok(await dialog.getByLabel("AI 편집 명령").isEnabled());
      assert.equal(await dialog.getByLabel("AI 편집 명령").inputValue(), "제목을 키워 줘");
      await dialog.getByRole("button", { name: "AI 명령 닫기" }).click();
      // Right click anywhere in the editor toggles the same panel.
      await page.locator(`[data-tab-id="${tabId}"]`).click({ button: "right", position: { x: 12, y: 12 } });
      await dialog.waitFor();
      await dialog.press("Escape"); await dialog.waitFor({ state: "detached" });
      const undo = type === "slideshow" ? page.getByRole("button", { name: "되돌리기", exact: true }) : page.getByRole("button", { name: /되돌리기/ }).first();
      await undo.click();
      await page.waitForTimeout(250);
      const current = await call(type === "slideshow" ? "read_project" : "read_video_project", { projectId: id });
      const color = type === "slideshow" ? (current.editor as {document:{slides:Array<{backgroundColor:string}>}}).document.slides[0].backgroundColor
        : (current.document as {backgroundColor:string}).backgroundColor;
      assert.notEqual(color, "#123456");
      await page.getByRole("button", { name: "텍스트 추가", exact: true }).click();
      await page.getByRole("button", { name: "AI 명령 열기" }).click();
      await dialog.getByText("AI 편집 · 선택 요소 · 범위 자동", { exact: true }).waitFor();
      await dialog.getByLabel("AI 편집 명령").fill("선택한 요소 어때?");
      await dialog.getByRole("button", { name: "실행", exact: true }).click();
      await dialog.getByText("제목을 조금 키우면 읽기 좋습니다.").waitFor();
      const selection = submitted.at(-1)?.selection as { placementIds?: string[]; layerIds?: string[] };
      assert.equal(type === "slideshow" ? selection.placementIds?.length : selection.layerIds?.length, 1);
      await dialog.getByRole("button", { name: "AI 명령 닫기" }).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("button", { name: "AI 명령 열기" }).click();
      const box = await dialog.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844);
      await dialog.getByRole("button", { name: "AI 명령 닫기" }).click();
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    assert.deepEqual(errors, []);
    console.log("PASS editor AI panels, questions, apply, background execution, scope and existing undo in both editors");
  } finally { await page.close(); await client.close(); }
}
