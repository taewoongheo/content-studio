import assert from "node:assert/strict";
import test from "node:test";
import { CollectionRegistry } from "./registry";
import { CollectionBlocked, type CollectionRequest, type CollectionResult } from "./types";
import { emptyMetrics } from "../domain/schema";
import { socialSource } from "../domain/source";

const request: CollectionRequest = { source: socialSource("https://www.tiktok.com/@a/photo/123", "post"), kind: "post", limit: 1, criteria: { minViews: 100_000 } };
const result: CollectionResult = { posts: [{ id: "123", platform: "tiktok", url: request.source.url, author: "a",
  text: "routine", format: "slideshow", publishedAt: null, publishedLabel: null, collectedAt: new Date().toISOString(),
  media: [], metrics: emptyMetrics() }], warnings: [], nextCursor: null };
const tick = () => new Promise(resolve => setImmediate(resolve));

test("a blocked job retains its session for retry and never upgrades unknown metrics", async () => {
  const sessions: string[] = [];
  const registry = new CollectionRegistry(async (_, context) => {
    sessions.push(context.sessionId);
    if (sessions.length === 1) throw new CollectionBlocked("access_denied", "HTTP 403 without a visible challenge");
    return result;
  });
  const job = registry.start(request);
  await tick();
  assert.equal(registry.snapshot(job.jobId).block?.reason, "access_denied");
  registry.resume(job.jobId); await tick();
  const done = registry.snapshot(job.jobId);
  assert.equal(done.status, "complete");
  assert.equal(done.posts?.[0].criteriaEvaluation.status, "unverified");
  assert.equal(sessions[0], sessions[1]);
  await registry.close(job.sessionId);
  assert.throws(() => registry.snapshot(job.jobId), /Unknown/);
  assert.deepEqual(await registry.close(job.sessionId), { sessionId: job.sessionId, closed: true });
});
test("close cancels in-flight work and forbids reuse of expired sessions", async () => {
  let complete!: (value: CollectionResult) => void;
  const registry = new CollectionRegistry(() => new Promise(resolve => { complete = resolve; }));
  const job = registry.start(request);
  assert.throws(() => registry.start(request, job.sessionId), /current collection/);
  await registry.close(job.sessionId); complete(result); await tick();
  assert.throws(() => registry.snapshot(job.jobId), /Unknown/);
  assert.throws(() => registry.start(request, job.sessionId), /closed/);
});
test("one session cannot run overlapping retries and automatic retries are bounded", async () => {
  const registry = new CollectionRegistry(async () => { throw new CollectionBlocked("rate_limited", "429"); });
  const job = registry.start(request); await tick();
  registry.resume(job.jobId); await tick(); registry.resume(job.jobId); await tick();
  assert.throws(() => registry.resume(job.jobId), /three-attempt/);
  await registry.close(job.sessionId);
});

test("missing authentication blocks native search before the collector runs and informs the agent", async () => {
  const { AccountManager } = await import("../accounts/manager");
  const { AccountStore } = await import("../accounts/storage/store");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "research-job-")); let calls = 0;
  const accounts = new AccountManager(new AccountStore(directory));
  const registry = new CollectionRegistry(async () => { calls++; return result; }, undefined, accounts);
  try {
    const search = { platform: "tiktok" as const, query: "gym tips", type: "posts" as const, limit: 5 };
    const job = registry.start({ source: { platform: "tiktok", id: search.query, url: "https://www.tiktok.com/search?q=gym%20tips" }, kind: "search", search, limit: 5 });
    await tick(); const snapshot = registry.snapshot(job.jobId);
    assert.equal(calls, 0); assert.equal(snapshot.block?.reason, "login_required");
    assert.equal(snapshot.account?.status, "disconnected"); await registry.close(job.sessionId);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("confirmed login rejection updates dashboard status while generic access denial does not", async () => {
  const { AccountManager } = await import("../accounts/manager");
  const { AccountStore } = await import("../accounts/storage/store");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "research-job-"));
  const accounts = new AccountManager(new AccountStore(directory));
  const state = { cookies: [{ name: "sessionid", value: "test-secret", domain: ".tiktok.com", path: "/", expires: -1,
    httpOnly: true, secure: true, sameSite: "None" as const }], origins: [] };
  try {
    for (const reason of ["access_denied", "login_required"] as const) {
      accounts.store.save("tiktok", state);
      const registry = new CollectionRegistry(async () => { throw new CollectionBlocked(reason, "test"); }, undefined, accounts);
      const job = registry.start(request); await tick();
      assert.equal(registry.snapshot(job.jobId).account?.status, reason === "login_required" ? "login_required" : "connected");
      assert.equal(JSON.stringify(registry.snapshot(job.jobId)).includes("test-secret"), false);
      await registry.close(job.sessionId);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
