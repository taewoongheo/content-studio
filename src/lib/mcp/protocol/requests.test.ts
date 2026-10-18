import assert from "node:assert/strict";
import test from "node:test";
import { RequestReceipts } from "./requests";
import { json } from "./result";
import { OperationError } from "@/lib/errors/operation";

test("concurrent retries share one execution; keys are canonical, tool-scoped and reject changed input", async () => {
  const receipts = new RequestReceipts();
  let calls = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const operation = async () => { calls++; await pending; return json({ projectId: "one" }); };
  const first = receipts.run("clone", { requestId: "one", settings: { width: 100, height: 200 } }, operation);
  const second = receipts.run("clone", { settings: { height: 200, width: 100 }, requestId: "one" }, operation);
  await Promise.resolve(); assert.equal(calls, 1);
  await assert.rejects(receipts.run("clone", { requestId: "one", settings: { width: 200 } }, operation),
    error => error instanceof OperationError && error.code === "REQUEST_ID_REUSED");
  release(); const [a, b] = await Promise.all([first, second]); assert.deepEqual(a, b);
  a.structuredContent!.projectId = "mutated";
  assert.equal((await receipts.run("clone", { requestId: "one", settings: { width: 100, height: 200 } }, operation)).structuredContent!.projectId, "one");
  await receipts.run("create", { requestId: "one" }, operation); assert.equal(calls, 2);
  await receipts.run("clone", {}, operation); await receipts.run("clone", {}, operation); assert.equal(calls, 4);
});

test("receipts retain failures, never expire pending work or evict unexpired outcomes to admit new work", async () => {
  let now = 0, calls = 0, release!: () => void;
  const receipts = new RequestReceipts({ now: () => now, retentionMs: 10, maxEntries: 1 });
  const pending = new Promise<void>(resolve => { release = resolve; });
  const op = async () => { calls++; await pending; throw new Error("original failure"); };
  const first = receipts.run("create", { requestId: "one" }, op);
  now = 100;
  const retry = receipts.run("create", { requestId: "one" }, op);
  await assert.rejects(receipts.run("create", { requestId: "two" }, op), error => error instanceof OperationError && error.code === "REQUEST_CACHE_FULL");
  release(); assert.equal((await first).isError, true); assert.deepEqual(await retry, await first); assert.equal(calls, 1);
  now = 109; assert.deepEqual(await receipts.run("create", { requestId: "one" }, op), await first); assert.equal(calls, 1);
  now = 110; await receipts.run("create", { requestId: "two" }, op); assert.equal(calls, 2);
});

test("receipt byte limit rejects new operations while preserving existing replay", async () => {
  const receipts = new RequestReceipts({ maxBytes: 1 }); let calls = 0;
  const op = () => { calls++; return json({ id: "result" }); };
  const result = await receipts.run("create", { requestId: "one" }, op);
  await assert.rejects(receipts.run("create", { requestId: "two" }, op), error => error instanceof OperationError && error.code === "REQUEST_CACHE_FULL");
  assert.deepEqual(await receipts.run("create", { requestId: "one" }, op), result); assert.equal(calls, 1);
});
