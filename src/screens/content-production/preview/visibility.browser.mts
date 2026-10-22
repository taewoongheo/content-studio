import assert from "node:assert/strict";
import { chromium } from "playwright";

// Run against pnpm dev. Only the in-memory preview is used; API traffic fails the check.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const apiRequests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
  });
  await page.goto(`${process.env.CONTENT_STUDIO_TEST_ORIGIN ?? "http://127.0.0.1:3000"}/preview/production`);
  await page.locator('[data-id="start"]').waitFor();
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-id="start"]')?.getBoundingClientRect();
    const canvas = document.querySelector('.production-canvas')?.getBoundingClientRect();
    return !!node && !!canvas && Math.abs(node.x + node.width / 2 - canvas.x - canvas.width / 2) < 1 && Math.abs(node.y + node.height / 2 - canvas.y - canvas.height / 2) < 1;
  });
  const viewport = () => page.locator(".react-flow__viewport").evaluate(element => {
    const matrix = new DOMMatrix(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.m11 };
  });
  let before = await viewport();
  await page.mouse.move(1200, 650);
  await page.mouse.wheel(180, 0);
  await page.waitForTimeout(100);
  let after = await viewport();
  assert.ok(after.x < before.x, "horizontal wheel must pan the canvas");
  assert.equal(after.y, before.y);
  assert.equal(after.zoom, before.zoom);
  before = after;
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 100);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(100);
  after = await viewport();
  assert.ok(after.x < before.x, "Shift+wheel must pan horizontally");
  assert.equal(after.zoom, before.zoom);
  before = after;
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(300);
  assert.notEqual((await viewport()).zoom, before.zoom, "vertical wheel must retain zoom");
  await page.getByRole("button", { name: "시작 노드로 이동", exact: true }).click();
  await page.waitForTimeout(350);
  await page.evaluate(`(() => {
    const state = { seen: new Set(), hidden: [], missing: [], camera: "", moved: false, stopped: false };
    window.visibilityCheck = state;
    const check = () => {
      if (state.stopped) return;
      const nodes = [...document.querySelectorAll(".react-flow__node")];
      for (const node of nodes) {
        const id = node.dataset.id;
        const visible = getComputedStyle(node).visibility === "visible";
        if (state.seen.has(id) && !visible) state.hidden.push(id);
        if (visible) state.seen.add(id);
      }
      for (const id of state.seen) if (!nodes.some(node => node.dataset.id === id)) state.missing.push(id);
      const transform = document.querySelector(".react-flow__viewport")?.style.transform;
      if (transform) {
        if (state.camera && transform !== state.camera) state.moved = true;
        state.camera = transform;
      }
      requestAnimationFrame(check);
    };
    check();
  })()`);
  await page.getByRole("combobox", { name: "재생 속도" }).selectOption("2");
  await page.getByRole("button", { name: "4개 병렬 재생", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node [aria-label="완료"]').length === 13, undefined, { timeout: 25_000 });
  await page.waitForTimeout(600);
  const result = await page.evaluate(() => {
    const state = (window as unknown as { visibilityCheck: { hidden: string[]; missing: string[]; moved: boolean; stopped: boolean } }).visibilityCheck;
    state.stopped = true;
    return { hidden: state.hidden, missing: state.missing, moved: state.moved, count: document.querySelectorAll(".react-flow__node").length };
  });
  assert.deepEqual(result.hidden, [], "existing nodes must never become hidden during data updates");
  assert.deepEqual(result.missing, [], "existing nodes must not disappear from the node list");
  assert.equal(result.moved, false, "progress must preserve the viewport");
  assert.equal(result.count, 14);
  const paths = await page.locator(".react-flow__edge").evaluateAll(edges => edges.map(edge => {
    const path = edge.querySelector<SVGPathElement>(".react-flow__edge-path")!;
    const start = path.getPointAtLength(0), end = path.getPointAtLength(path.getTotalLength());
    return { id: (edge as HTMLElement).dataset.id, startY: start.y, endY: end.y, path: path.getAttribute("d")! };
  }));
  assert.equal(paths.filter(path => path.id === "sync-branch-trunk").length, 1, "parallel branches share a single trunk");
  for (const path of paths.filter(path => path.id !== "sync-branch-trunk")) {
    assert.ok(Math.abs(path.startY - path.endY) < 0.01, `${path.id} must stay horizontal despite differing card heights`);
    assert.doesNotMatch(path.path, /[VQC]/, "row arrows must not bend");
  }
  assert.deepEqual(apiRequests, [], "preview must not call real APIs");
  console.log("PASS continuous parallel playback: node visibility, retained nodes, fixed camera and zero API calls");
} finally {
  await browser.close();
}
