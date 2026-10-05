import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import sharp from "sharp";
import { solveCaptcha } from "../../src/lib/research/browser/captcha/captcha";

const directory = await mkdtemp(join(tmpdir(), "studio-research-smoke-"));
const listener = createServer();
await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
const address = listener.address();
if (!address || typeof address === "string") throw new Error("No test port");
const port = address.port;
await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const origin = `http://127.0.0.1:${port}`;
let logs = "";
const app = spawn("pnpm", ["start", "--port", String(port)], { detached: process.platform !== "win32",
  env: { ...process.env, CONTENT_STUDIO_DB_PATH: join(directory, "test.sqlite") }, stdio: ["ignore", "pipe", "pipe"] });
app.stdout.on("data", chunk => { logs = (logs + chunk).slice(-5000); });
app.stderr.on("data", chunk => { logs = (logs + chunk).slice(-5000); });
const client = new Client({ name: "research-live-smoke", version: "1" });
const sessions = new Set<string>();
const pause = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
type Job = { jobId: string; sessionId: string; status: string; block?: { reason: string }; nextCursor?: string;
  posts?: Array<{ id: string; media: Array<{ type: string }>; metrics: Record<string, number | null>; criteriaEvaluation: { status: string } }> };
async function call(name: string, args: Record<string, unknown>) {
  const response = await client.callTool({ name, arguments: args }) as CallToolResult;
  if (response.isError) throw new Error(`${name}: ${JSON.stringify(response.content)}`);
  return response;
}
async function collect(name: string, args: Record<string, unknown>) {
  const job = (await call(name, args)).structuredContent as Job;
  sessions.add(job.sessionId);
  const deadline = Date.now() + 60_000;
  while (true) {
    const result = (await call("get_collection_job", { jobId: job.jobId })).structuredContent as Job;
    if (result.status !== "running") return result;
    if (Date.now() > deadline) throw new Error(`${name} timed out`);
    await pause(500);
  }
}
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    try { if ((await fetch(`${origin}/mcp`)).status === 405) break; } catch { /* app starting */ }
    if (app.exitCode !== null || Date.now() > deadline) throw new Error(`App did not start: ${logs}`);
    await pause(200);
  }
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  const criteria = { format: "slideshow", minViews: 100_000 };
  for (const [url, channelUrl, expectedImages] of [
    ["https://www.instagram.com/p/BoHk1haB5tM/", undefined, 5],
    ["https://www.tiktok.com/@chillezy/photo/7240568259186019630", undefined, 16],
    ["https://www.youtube.com/post/Ugkxtn5ePqjfZKSacMAMKWmP1WRsXk98kzYX", "https://www.youtube.com/@JeffNippard", 4],
  ] as const) {
    const job = await collect("read_social_post", { url, ...(channelUrl ? { channelUrl } : {}), criteria });
    assert.equal(job.status, "complete", JSON.stringify(job.block));
    const post = job.posts?.[0]; assert.ok(post);
    assert.equal(post.media.length, expectedImages);
    assert.equal(post.criteriaEvaluation.status, "unverified");
    assert.equal(post.metrics.viewCount, null);
    const images = await call("read_post_images", { jobId: job.jobId, postId: post.id, imageIndexes: [expectedImages - 1] });
    assert.ok(images.content.some(item => item.type === "image" && item.data.length > 0));
    console.log("PASS live post and final slide through HTTP MCP", { platformUrl: url, imageCount: post.media.length, metrics: post.metrics });
  }
  const first = await collect("list_account_posts", { accountUrl: "https://www.youtube.com/@JeffNippard", limit: 3 });
  assert.equal(first.status, "complete"); assert.equal(first.posts?.length, 3); assert.ok(first.nextCursor);
  const second = await collect("list_account_posts", { accountUrl: "https://www.youtube.com/@JeffNippard", limit: 3, sessionId: first.sessionId, cursor: first.nextCursor });
  assert.equal(second.status, "complete"); assert.equal(second.posts?.length, 3);
  assert.equal(second.posts?.filter(post => first.posts?.some(previous => previous.id === post.id)).length, 0);
  console.log("PASS bounded YouTube account pagination", { first: first.posts?.length, second: second.posts?.length });
  for (const accountUrl of ["https://www.instagram.com/jeffnippard/", "https://www.tiktok.com/@hullcity"]) {
    const job = await collect("list_account_posts", { accountUrl, limit: 3 });
    assert.ok(["complete", "blocked"].includes(job.status));
    console.log("OBSERVED anonymous account collection", { accountUrl, status: job.status, reason: job.block?.reason, count: job.posts?.length });
    if (accountUrl.includes("tiktok")) {
      const browser = await call("open_collection_browser", { jobId: job.jobId });
      assert.equal((browser.structuredContent as { sessionId: string }).sessionId, job.sessionId);
      assert.ok(browser.content.some(item => item.type === "image"));
      console.log("PASS same TikTok collection browser handoff");
    }
  }
  // A synthetic controlled challenge validates the actual local engine and mouse
  // path. This is not evidence of solving a live TikTok CAPTCHA.
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const piece = await sharp(Buffer.from(`<svg width="80" height="80"><rect width="80" height="80" fill="black"/><path d="M10 10H35V20H50V10H70V40H60V55H70V70H40V60H25V70H10Z" fill="white"/></svg>`)).png().toBuffer();
    const background = await sharp({ create: { width: 360, height: 180, channels: 3, background: "black" } })
      .composite([{ input: piece, left: 190, top: 50 }]).png().toBuffer();
    await page.setContent(`<div class="captcha_verify_test" style="position:relative;width:400px;height:320px">
      <img id="bg" src="data:image/png;base64,${background.toString("base64")}" style="position:absolute;left:0;top:0">
      <img id="piece" src="data:image/png;base64,${piece.toString("base64")}" style="position:absolute;left:0;top:190px">
      <div id="track" style="position:absolute;left:0;top:290px;width:360px;height:20px;background:#ddd">
      <div id="handle" style="width:20px;height:20px;background:#333"></div></div></div>
      <script>let start;handle.onmousedown=e=>{start=e.clientX};document.onmouseup=e=>{if(start!==undefined&&Math.abs(e.clientX-start-190)<3)document.querySelector('.captcha_verify_test').remove()}</script>`);
    const solved = await solveCaptcha(page, { type: "slider", backgroundSelector: "#bg", pieceSelector: "#piece", sliderSelector: "#handle", trackSelector: "#track" });
    assert.equal(solved.status, "challenge_cleared", JSON.stringify(solved));
    console.log("PASS synthetic slider with actual pinned local recognition engine; live TikTok CAPTCHA remains unverified");
  } finally { await browser.close(); }
} finally {
  for (const sessionId of sessions) await client.callTool({ name: "close_collection_session", arguments: { sessionId } }).catch(() => undefined);
  await client.close();
  if (app.pid) { try { if (process.platform === "win32") app.kill(); else process.kill(-app.pid, "SIGTERM"); } catch { /* already stopped */ } }
  await rm(directory, { recursive: true, force: true });
}
