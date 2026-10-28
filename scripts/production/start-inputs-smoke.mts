import assert from "node:assert/strict";
import type { Browser } from "playwright";
import type { PublishedPost } from "../../src/domains/content-production/domain/published-posts";
import type { ProductionRequest } from "../../src/domains/content-production/domain/start/input";

/** Exercise the real UI with intercepted starts; never invoke paid production during a smoke run. */
export async function verifyProductionStart(browser: Browser, origin: string, post: PublishedPost) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  let submitted: ProductionRequest[] | undefined, attempts = 0;
  await page.route("**/api/content-production", async route => {
    const request = route.request();
    if (request.headers().accept?.includes("text/event-stream")) return route.continue();
    if (request.method() === "GET") {
      const response = await route.fetch();
      const snapshot = await response.json();
      return route.fulfill({ json: { ...snapshot, publishedPosts: [post], configured: { apify: true } } });
    }
    const input = request.postDataJSON();
    if (input.action !== "start") return route.continue();
    submitted = input.requests;
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 400, json: { error: "Fixture start failed" } } : { json: { ids: [] } });
  });
  try {
    await page.goto(origin);
    await page.getByRole("button", { name: "제작 캔버스", exact: true }).click();
    const add = page.getByRole("button", { name: "제작 요청 추가", exact: true });
    await add.click();
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.getByRole("button", { name: "1번 요청 수정", exact: true }).click();
    await page.getByLabel("추가 지침", { exact: false }).fill("덤벨만 사용");
    await page.getByRole("dialog").getByRole("button", { name: "수정", exact: true }).click();
    await add.click();
    await page.getByRole("radio", { name: "과거 게시글", exact: true }).check();
    await page.getByLabel("원본 게시글", { exact: true }).selectOption(post.id);
    await page.getByRole("region", { name: `${post.name} 슬라이드 미리보기`, exact: true }).waitFor();
    await page.getByRole("img", { name: "1번 슬라이드", exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await add.click();
    await page.getByRole("radio", { name: "외부 URL", exact: true }).check();
    await page.getByLabel("TikTok 슬라이드쇼 URL", { exact: true }).fill("https://example.com/post");
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "TikTok 게시물의 전체 URL" }).waitFor();
    await page.getByLabel("TikTok 슬라이드쇼 URL", { exact: true }).fill("https://www.tiktok.com/@example/photo/123?tracking=1");
    await page.getByLabel("추가 지침", { exact: false }).fill("초보자 대상");
    if (process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/start-dialog.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.getByRole("dialog").boundingBox();
    assert.ok(box && box.x >= 0 && box.width <= 390 && box.height <= 844, "input modal fits a narrow viewport");
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "1번 요청 삭제", exact: true }).click();
    assert.equal(await page.getByRole("list", { name: "제작 요청 목록" }).getByRole("listitem").count(), 2);
    await add.click();
    await page.getByRole("dialog").getByRole("button", { name: "추가", exact: true }).click();
    if (process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CONTENT_STUDIO_SMOKE_SCREENSHOT_DIR}/start-requests.png` });
    const start = page.getByRole("button", { name: "3개 제작 시작", exact: true });
    await start.click();
    await page.getByRole("alert").filter({ hasText: "Fixture start failed" }).waitFor();
    assert.equal(await page.getByRole("list", { name: "제작 요청 목록" }).getByRole("listitem").count(), 3, "failed start preserves requests");
    await start.click();
    await page.getByRole("list", { name: "제작 요청 목록" }).waitFor({ state: "detached" });
    assert.deepEqual(submitted, [
      { mode: "past_post", sourceProjectId: post.id, instructions: "" },
      { mode: "external_url", url: "https://www.tiktok.com/@example/photo/123", instructions: "초보자 대상" },
      { mode: "automatic", instructions: "" },
    ]);
    assert.deepEqual(browserErrors, []);
    console.log("PASS start modal modes, saved preview, optional instructions, edit/delete, narrow viewport and failed-start recovery");
  } finally { await page.close(); }
}
