import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import type { VideoSnapshot } from "../../src/lib/video/domain/model";
const directory = await mkdtemp(join(tmpdir(), "studio-video-smoke-"));
const portServer = createServer();
await new Promise<void>(resolve => portServer.listen(0, "127.0.0.1", resolve));
const address = portServer.address(); if (!address || typeof address === "string") throw new Error("No port");
const port = address.port;
await new Promise<void>((resolve, reject) => portServer.close(e => e ? reject(e) : resolve()));
const origin = `http://127.0.0.1:${port}`, distDir = `.next-video-smoke-${process.pid}`, config = `.next-mcp-smoke-video-${process.pid}.tsconfig.json`;
await writeFile(config, await readFile("tsconfig.json"));
let log = "";
function start() {
  const child = spawn("pnpm", ["dev", "--port", String(port)], { detached: true, env: { ...process.env, CONTENT_STUDIO_DB_PATH: join(directory, "test.sqlite"), CONTENT_STUDIO_RESEARCH_RUNTIME_DIR: join(directory, "research"), CONTENT_STUDIO_DIST_DIR: distDir, CONTENT_STUDIO_TSCONFIG_PATH: config }, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", b => { log = (log + b).slice(-15000); }); child.stderr.on("data", b => { log = (log + b).slice(-15000); }); return child;
}
let app = start();
const stop = () => { try { if (app.pid) process.kill(-app.pid, "SIGTERM"); } catch { /* stopped */ } };
async function ready() { const deadline = Date.now() + 60000; while (true) { try { if ((await fetch(`${origin}/mcp`)).status === 405) return; } catch { /* Starting. */ } if (Date.now() > deadline || app.exitCode !== null) throw new Error(log); await new Promise(r => setTimeout(r, 200)); } }
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${origin}${path}`, { method, headers: { origin, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text(); if (!response.ok) throw new Error(`${response.status}: ${text}`); return text ? JSON.parse(text) : null;
}
const browser = await chromium.launch({ headless: true });
try {
  await ready();
  const videoPath = join(directory, "exercise.mp4"), audioPath = join(directory, "music.wav"), imagePath = join(directory, "image.png");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoPath]);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "2", audioPath]);
  await sharp({ create: { width: 64, height: 64, channels: 4, background: "#ff8800" } }).png().toFile(imagePath);
  const slide = await request("/api/content-jobs", "POST");
  await request("/api/content-projects", "POST", { jobId: slide.id, name: "SLIDESHOW_ONLY" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${origin}/?job=${slide.id}`);
  await page.getByRole("complementary", { name: "Element 레이어", exact: true }).waitFor();
  await page.screenshot({ path: join(tmpdir(), "content-studio-slideshow-ux-reference.png") });
  await page.getByRole("button", { name: "새 작업으로 돌아가기", exact: true }).click();
  await page.getByRole("button", { name: "편집기 열기", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /SLIDESHOW_ONLY/ }).waitFor();
  await dialog.getByRole("button", { name: "영상", exact: true }).click();
  assert.equal(await dialog.getByRole("button", { name: /SLIDESHOW_ONLY/ }).count(), 0);
  await dialog.getByRole("button", { name: "새 영상 시작" }).click();
  await page.getByRole("button", { name: "영상 이어붙이기", exact: true }).waitFor();
  const inspectorBox = await page.getByRole("complementary", { name: "선택 항목 편집", exact: true }).boundingBox();
  const layersBox = await page.getByRole("complementary", { name: "Element 레이어", exact: true }).boundingBox();
  const canvasBox = await page.getByRole("region", { name: "영상 편집 영역", exact: true }).boundingBox();
  assert.ok(inspectorBox && layersBox && canvasBox && inspectorBox.x < canvasBox.x && canvasBox.x < layersBox.x);
  assert.equal(await page.locator("header").getByRole("button", { name: "텍스트 추가", exact: true }).count(), 0);
  const id = new URL(page.url()).searchParams.get("job")!;
  const read = (): Promise<VideoSnapshot> => request(`/api/video-projects/${id}`);
  assert.equal((await read()).document.backgroundColor, "#FFFFFF");
  await page.getByLabel("안전 영역 가이드", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("checkbox", { name: "가이드", exact: true }).uncheck();
  assert.equal(await page.getByLabel("안전 영역 가이드", { exact: true }).count(), 0);
  await page.getByRole("checkbox", { name: "가이드", exact: true }).check();
  assert.equal((await request("/api/video-projects")).length, 0, "빈 영상은 DB에 저장하지 않는다");
  await page.getByLabel("영상 캔버스", { exact: true }).screenshot({ path: join(tmpdir(), "content-studio-video-white-guides.png") });
  async function addFile(button: string, paths: string | string[]) {
    const picker = page.waitForEvent("filechooser"); await page.getByRole("button", { name: button, exact: true }).click(); await (await picker).setFiles(paths);
    await page.waitForFunction(() => !document.body.innerText.includes("처리 중…"));
    await page.getByRole("button", { name: "영상 추가", exact: true }).waitFor({ state: "visible" });
  }
  await addFile("영상 이어붙이기", [videoPath, videoPath]);
  let saved = await read();
  assert.deepEqual(saved.document.layers.map(l => l.from), [0, 30]);
  const front = page.locator("[data-video-layer]").first(), back = page.locator("[data-video-layer]").last();
  const frontBox = await front.boundingBox(), backBox = await back.boundingBox(); assert.ok(frontBox && backBox);
  const originalFrontId = await front.getAttribute("data-video-layer");
  await page.mouse.move(frontBox.x + frontBox.width / 2, frontBox.y + frontBox.height / 2); await page.mouse.down();
  await page.mouse.move(backBox.x + backBox.width / 2, backBox.y + backBox.height / 2, { steps: 10 }); await page.mouse.up();
  await page.getByRole("button", { name: /^저장(됨| 중)?$/ }).click();
  await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
  const reordered = await read();
  assert.equal(reordered.document.layers[0].id, originalFrontId);
  for (const layer of saved.document.layers) assert.equal(reordered.document.layers.find(l => l.id === layer.id)?.from, layer.from, "레이어 이동은 재생 순서를 변경하지 않는다");
  // Select the second clip by stable ID after changing its stack position.
  await page.locator(`[data-video-layer="${saved.document.layers[1].id}"]`).click();
  await page.getByLabel("원본 끝 (초)", { exact: true }).fill("0.5");
  await page.getByRole("button", { name: /^저장(됨| 중)?$/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes("저장됨"));
  const trimmed = await read(); assert.equal(trimmed.document.layers.find(l => l.id === saved.document.layers[1].id)?.duration, 15);
  const bytes = [...await readFile(videoPath)];
  const transfer = await page.evaluateHandle(bytes => { const data = new DataTransfer(); data.items.add(new File([new Uint8Array(bytes)], "dropped-exercise.mp4", { type: "video/mp4" })); return data; }, bytes);
  const canvas = page.getByLabel("영상 캔버스", { exact: true });
  await canvas.dispatchEvent("dragenter", { dataTransfer: transfer });
  await page.getByText("영상·이미지를 놓아 추가하세요", { exact: true }).waitFor();
  await canvas.dispatchEvent("drop", { dataTransfer: transfer });
  await page.waitForFunction(() => document.body.innerText.includes("레이어 · 3") && !document.body.innerText.includes("처리 중…"));
  const handle = page.getByRole("button", { name: "dropped-exercise.mp4 크기 조절", exact: true });
  const beforeResize = (await read()).document.layers[2];
  const rect = await handle.boundingBox(); assert.ok(rect);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 40, rect.y + rect.height / 2 + 30, { steps: 6 }); await page.mouse.up();
  await page.getByRole("button", { name: /^저장(됨| 중)?$/ }).click();
  const resized = (await read()).document.layers[2]; assert.ok(resized.width > beforeResize.width); assert.ok(resized.height > beforeResize.height);
  assert.ok(Math.abs(resized.width / resized.height - beforeResize.width / beforeResize.height) < 0.01);
  assert.ok(resized.kind === "video" && !resized.sequence);
  await page.screenshot({ path: join(tmpdir(), "content-studio-video-drop-resize.png") });
  for (let i = 0; i < 2; i++) { await addFile("영상 추가", videoPath); await page.getByLabel("X (%)", { exact: true }).fill(String(i * 30)); await page.getByLabel("Y (%)", { exact: true }).fill("31.25"); }
  await addFile("오디오 추가", audioPath); await addFile("이미지 추가", imagePath);
  await page.getByRole("button", { name: "텍스트 추가", exact: true }).click();
  await page.getByLabel("텍스트", { exact: true }).fill("THREE EXERCISES");
  await page.getByLabel("글자색", { exact: true }).fill("#ff3366");
  await page.getByLabel("도형 추가", { exact: true }).selectOption("rectangle");
  await page.getByLabel("채우기 색", { exact: true }).fill("#123456");
  await page.getByLabel("회전 (°)", { exact: true }).fill("15");
  await page.waitForFunction(() => document.body.innerText.includes("저장됨"), { timeout: 10000 });
  saved = await read();
  assert.equal(saved.document.layers.filter(l => l.kind === "video" && !l.sequence).length, 3);
  assert.equal(saved.document.layers.length, 9);
  assert.equal(saved.document.layers.at(-1)?.rotation, 15);
  await page.getByRole("button", { name: "되돌리기", exact: true }).click();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await page.getByRole("button", { name: /^저장(됨| 중)?$/ }).click();
  assert.equal((await read()).document.layers.at(-1)?.rotation, 15);
  // Shortcut listeners must use the current selection after edits and history updates.
  await page.getByRole("button", { name: "저장됨", exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await page.keyboard.press("ControlOrMeta+s");
  await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
  const pasted = (await read()).document.layers.at(-1)!;
  assert.equal((await read()).document.layers.length, 10);
  assert.notEqual(pasted.id, saved.document.layers.at(-1)?.id);
  assert.equal(pasted.rotation, 15);
  await page.keyboard.press("Delete");
  await page.keyboard.press("ControlOrMeta+s");
  await page.getByRole("button", { name: "저장됨", exact: true }).waitFor();
  assert.equal((await read()).document.layers.length, 9);
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForFunction(() => document.body.innerText.includes("레이어 · 10") && !document.body.innerText.includes("처리 중…"));
  assert.equal((await read()).document.layers.length, 10);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForFunction(() => document.body.innerText.includes("레이어 · 9") && !document.body.innerText.includes("처리 중…"));
  assert.equal((await read()).document.layers.length, 9);
  if (process.argv.includes("--profile")) {
    const cdp = await page.context().newCDPSession(page); await cdp.send("Profiler.enable"); await cdp.send("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
    await page.getByRole("button", { name: "재생", exact: true }).click();
    const samples = await page.evaluate(`(async () => {
      const frames = [], moves = []; let last = performance.now(), x = 0;
      await new Promise(resolve => { const until = performance.now() + 2000; const tick = (now) => { const line = document.querySelector("[aria-label='재생 헤드']") ?? document.querySelector("[aria-label='타임라인'] .bg-red-400"); const next = line?.getBoundingClientRect().x ?? 0; frames.push(now - last); moves.push(Math.abs(next - x)); x = next; last = now; if (now < until) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
      return { samples: frames.length, stallsOver50ms: frames.filter(d => d > 50).length, meanFrameMs: frames.reduce((a,b) => a+b, 0) / frames.length, movingSamples: moves.filter(d => d > 0.01).length };
    })()`) as { samples: number; stallsOver50ms: number; meanFrameMs: number; movingSamples: number };
    await page.getByRole("button", { name: "일시정지", exact: true }).click();
    const coverage = await cdp.send("Profiler.takePreciseCoverage");
    const renders = coverage.result.flatMap(script => script.functions.filter(fn => fn.functionName === "VideoScreen").map(fn => ({ name: fn.functionName, calls: fn.ranges[0]?.count })));
    console.log("PLAYBACK PROFILE", JSON.stringify({ ...samples, renders })); await cdp.detach();
  }
  await page.screenshot({ path: join(tmpdir(), "content-studio-video-ux.png") });
  assert.equal(await page.getByRole("button", { name: "ZIP 내보내기", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "ZIP 불러오기", exact: true }).count(), 0);
  const beforeAppend = await read();
  const beforeEnd = Math.max(beforeAppend.document.duration, ...beforeAppend.document.layers.map(l => l.from + l.duration));
  const audioBefore = beforeAppend.document.layers.find(l => l.kind === "audio")!;
  const audioWidthBefore = (await page.getByRole("button", { name: "music.wav 타이밍", exact: true }).boundingBox())!.width;
  const rulerBox = await page.getByRole("slider", { name: "재생 위치", exact: true }).boundingBox();
  const headBox = await page.getByLabel("재생 헤드", { exact: true }).boundingBox();
  assert.ok(rulerBox && headBox && Math.abs(headBox.y - rulerBox.y) < 1, "재생선은 상단 눈금에서 시작한다");
  await addFile("MP4 불러오기", videoPath);
  saved = await read();
  assert.equal(saved.document.layers.at(-1)?.from, beforeEnd, "이어붙이기는 오디오·텍스트를 포함한 전체 끝에 추가한다");
  assert.equal(saved.document.layers.at(-1)?.duration, 30);
  assert.equal(saved.document.layers.find(l => l.id === audioBefore.id)?.duration, 60, "오디오는 원본 2초 그대로다");
  assert.ok(Math.abs((await page.getByRole("button", { name: "music.wav 타이밍", exact: true }).boundingBox())!.width - audioWidthBefore) < 1, "길이가 늘어도 눈금 배율은 변하지 않는다");
  const longName = "운동영상".repeat(29);
  await request(`/api/video-projects/${id}`, "PATCH", { name: longName });
  await page.getByRole("button", { name: "새 탭", exact: true }).click(); await dialog.getByRole("button", { name: "영상", exact: true }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForFunction(expected => { const box = document.querySelector("[role=dialog]")?.getBoundingClientRect(); return box && box.x >= 0 && box.right <= expected; }, width); const rect = await dialog.boundingBox(); assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width);
    const overflow = await dialog.evaluate(el => el.scrollWidth > el.clientWidth); assert.equal(overflow, false, `dialog overflow at ${width}`);
    await dialog.getByRole("button", { name: new RegExp(longName) }).waitFor();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog.getByRole("button", { name: "새 영상 시작" }).click();
  await addFile("MP4 불러오기", videoPath);
  await page.waitForFunction(() => document.body.innerText.includes("레이어 · 1") && !document.body.innerText.includes("처리 중…"));
  const importedId = new URL(page.url()).searchParams.get("job")!;
  assert.equal((await request(`/api/video-projects/${importedId}`)).assets.length, 1);
  const copied = await request(`/api/video-projects/${importedId}`, "POST", { action: "clone" });
  assert.equal(copied.assets.length, 1);
  await request(`/api/video-projects/${copied.id}`, "DELETE");
  assert.equal((await read()).assets.length, 8, "복사본 삭제는 원본 자산을 지우지 않는다");
  if (process.argv.includes("--render")) {
    await page.getByRole("navigation", { name: "프로젝트 탭", exact: true }).getByRole("button", { name: longName, exact: true }).click();
    const download = page.waitForEvent("download", { timeout: 240000 }); await page.getByRole("button", { name: "MP4 내보내기", exact: true }).click();
    const output = join(directory, "output.mp4"); await (await download).saveAs(output);
    const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,width,height", "-of", "json", output], { encoding: "utf8" }));
    assert.ok(probe.streams.some((s: { codec_name: string; width: number; height: number }) => s.codec_name === "h264" && s.width === 1080 && s.height === 1920));
    assert.ok(probe.streams.some((s: { codec_name: string }) => s.codec_name === "aac"));
    console.log("MP4 H.264 1080×1920 + AAC verified");
  }
  const before = await read();
  const bad = await fetch(`${origin}/api/video-projects/${id}`, { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ document: before.document, expectedTabId: before.tabId, expectedRevision: before.revision - 1 }) }); assert.equal(bad.status, 400);
  const range = await fetch(`${origin}/api/video-projects/${id}/assets/${before.assets[0].id}`, { headers: { Range: "bytes=0-9" } }); assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 10);
  await page.close();
  const exited = new Promise<void>(resolve => app.once("exit", () => resolve())); stop(); await exited; app = start(); await ready();
  const after = await read(); assert.notEqual(after.tabId, before.tabId); assert.deepEqual(after.document, before.document); assert.equal(after.assets.length, 8);
  assert.deepEqual(errors, []);
  console.log("video smoke passed: matched slideshow panels/actions, draggable stacking without timing changes, filters, menu widths, sequential and concurrent videos, audio/image/text/shapes, autosave/history, MP4 import, full-timeline append, uncompressed audio duration and fixed time scale, clone/delete, stale writes, byte ranges, restart persistence");
} catch (error) { const failed = browser.contexts()[0]?.pages()[0]; if (failed) { console.error(await failed.locator("body").innerText()); await failed.screenshot({ path: "/tmp/content-studio-video-smoke-failure.png" }); } console.error(log.slice(-10000)); throw error; }
finally { await browser.close(); const exited = app.exitCode === null ? new Promise<void>(resolve => app.once("close", () => resolve())) : Promise.resolve(); stop(); await exited; await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); await rm(distDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); await rm(config, { force: true }); }
