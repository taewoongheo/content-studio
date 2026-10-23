import assert from "node:assert/strict";
import test from "node:test";
import { CollectionRegistry } from "@/domains/research/collection/registry";
import { CollectionBlocked, type CollectionRequest, type CollectionResult } from "@/domains/research/collection/types";
import { emptyMetrics } from "@/domains/research/domain/schema";
import { socialSource } from "@/domains/research/domain/source";

const request: CollectionRequest = { source: socialSource("https://www.youtube.com/post/123", "post"), kind: "post", limit: 1, criteria: { minViews: 100_000 } };
const result: CollectionResult = { posts: [{ id: "123", platform: "youtube", url: request.source.url, author: "a",
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

test("legacy TikTok and Instagram collection is rejected before execution", () => {
  const registry = new CollectionRegistry(async () => { throw new Error("must not execute"); });
  for (const url of ["https://www.tiktok.com/@a/photo/123", "https://www.instagram.com/p/abc/"])
    assert.throws(() => registry.start({ ...request, source: socialSource(url,"post") }), /YouTube only/);
});
