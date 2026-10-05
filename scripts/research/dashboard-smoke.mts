import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const directory = await mkdtemp(join(tmpdir(), "studio-account-dashboard-"));
const listener = createServer();
await new Promise<void>(resolve => listener.listen(0, "127.0.0.1", resolve));
const address = listener.address(); if (!address || typeof address === "string") throw new Error("No test port");
await new Promise<void>(resolve => listener.close(() => resolve()));
const origin = `http://127.0.0.1:${address.port}`;
const runtime = join(directory, "research"), accountDir = join(runtime, "accounts");
await mkdir(accountDir, { recursive: true });
await writeFile(join(accountDir, "tiktok.json"), JSON.stringify({ updatedAt: new Date().toISOString(), reason: null,
  state: { cookies: [{ name: "sessionid", value: "fixture-session", domain: ".tiktok.com", path: "/", expires: 1,
    httpOnly: true, secure: true, sameSite: "None" }], origins: [] } }), { mode: 0o600 });
let logs = "";
const app = spawn("pnpm", ["start", "--port", String(address.port)], { detached: true, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, CONTENT_STUDIO_DB_PATH: join(directory, "test.sqlite"), CONTENT_STUDIO_RESEARCH_RUNTIME_DIR: runtime } });
app.stdout.on("data", value => { logs += value; }); app.stderr.on("data", value => { logs += value; });
const browser = await chromium.launch({ headless: true });
const client = new Client({ name: "search-dashboard-test", version: "1" });
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    try { if ((await fetch(`${origin}/api/research/accounts`)).ok) break; } catch { /* starting */ }
    if (app.exitCode !== null || Date.now() > deadline) throw new Error(`App did not start: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  const status = await fetch(`${origin}/api/research/accounts`).then(response => response.json());
  assert.equal(status.accounts[0].status, "login_required"); assert.equal(status.accounts[0].reason, "expired");
  assert.equal(JSON.stringify(status).includes("fixture-session"), false);
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(origin); await page.getByRole("tab", { name: /설정/ }).click();
  await page.getByRole("heading", { name: "리서치 계정 연결" }).waitFor();
  await page.getByRole("heading", { name: "TikTok", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "다시 로그인", exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "로그인", exact: true }).count(), 1);
  await page.screenshot({ path: "/tmp/content-studio-account-settings-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  await page.screenshot({ path: "/tmp/content-studio-account-settings-mobile.png", fullPage: true });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError, undefined); return result.structuredContent as Record<string, unknown>;
  };
  const accounts = await call("get_research_accounts");
  assert.deepEqual(accounts.accounts, status.accounts);
  const job = await call("search_social_candidates", { platform: "tiktok", query: "fitness", type: "posts", limit: 3 });
  await new Promise(resolve => setTimeout(resolve, 100));
  const blocked = await call("get_collection_job", { jobId: job.jobId });
  assert.equal(blocked.status, "blocked"); assert.equal((blocked.block as { reason: string }).reason, "login_required");
  assert.equal((blocked.account as { reason: string }).reason, "expired");
  await call("close_collection_session", { sessionId: job.sessionId });
  const forbidden = await fetch(`${origin}/api/research/accounts`, { method: "POST", headers: { origin: "https://other.example" },
    body: JSON.stringify({ platform: "tiktok", action: "disconnect" }) }); assert.equal(forbidden.status, 403);
  await page.getByRole("button", { name: "연결 해제", exact: true }).click();
  await page.getByRole("button", { name: "다시 로그인", exact: true }).waitFor({ state: "detached" });
  const disconnected = await call("get_research_accounts");
  assert.equal((disconnected.accounts as Array<{ status: string }>)[0].status, "disconnected");
  if (process.argv.includes("--live-youtube")) {
    const search = await call("search_social_candidates", { platform: "youtube", query: "gym tips", type: "accounts", limit: 3 });
    const deadline = Date.now() + 30_000;
    while (true) {
      const result = await call("get_collection_job", { jobId: search.jobId });
      if (result.status !== "running") { assert.equal(result.status, "complete", JSON.stringify(result.block)); assert.ok((result.accounts as unknown[]).length > 0); console.log("PASS live YouTube internal account search:", (result.accounts as unknown[]).length); break; }
      if (Date.now() > deadline) throw new Error("YouTube search timed out");
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    await call("close_collection_session", { sessionId: search.sessionId });
  }
  console.log("PASS production dashboard desktop/mobile, expired cookies shared with HTTP MCP, disconnect and same-origin protection");
} finally {
  await client.close(); await browser.close();
  if (app.pid) { try { process.kill(-app.pid, "SIGTERM"); } catch { /* exited */ } }
  await rm(directory, { recursive: true, force: true });
}
