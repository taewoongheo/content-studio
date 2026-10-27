import test from "node:test";
import assert from "node:assert/strict";
import { createTranslationQueue } from "./translation-queue";
import { createEditorLoadPriority } from "@/domains/workspace/client/editor-load-priority";

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test("at most two HTTP translations run, and completed jobs are not repeated", async () => {
  const queue = createTranslationQueue();
  const work = [deferred<number>(), deferred<number>(), deferred<number>()];
  const started: number[] = [];
  const results = work.map((item, index) => queue.run(undefined, async () => {
    started.push(index);
    return item.promise;
  }));
  await tick();
  assert.deepEqual(started, [0, 1]);
  work[0].resolve(0);
  await tick();
  assert.deepEqual(started, [0, 1, 2]);
  work[1].resolve(1); work[2].resolve(2);
  assert.deepEqual(await Promise.all(results), [0, 1, 2]);
});

test("editor opening aborts streams immediately, and retries after all foreground loads settle", async () => {
  const queue = createTranslationQueue();
  const priority = createEditorLoadPriority();
  const unsubscribe = priority.subscribe(queue.setPaused);
  const signals: AbortSignal[] = [];
  const result = queue.run(undefined, async signal => {
    signals.push(signal);
    if (signals.length > 1) return "translated";
    return new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  await tick();
  const ready = priority.begin();
  const anotherReady = priority.begin();
  assert.equal(signals[0].aborted, true);
  await tick();
  ready(); ready();
  await tick();
  assert.equal(signals.length, 1);
  anotherReady();
  assert.equal(await result, "translated");
  assert.equal(signals.length, 2);
  unsubscribe();
});

test("caller cancellation removes a preempted request instead of retrying it", async () => {
  const queue = createTranslationQueue(1);
  const caller = new AbortController();
  let attempts = 0;
  const result = queue.run(caller.signal, signal => {
    attempts++;
    return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  const rejected = assert.rejects(result, { name: "AbortError" });
  await tick();
  queue.setPaused(true);
  await tick();
  caller.abort();
  await rejected;
  queue.setPaused(false);
  await tick();
  assert.equal(attempts, 1);
});

test("queued cancellations and genuine failures do not block subsequent translations", async () => {
  const queue = createTranslationQueue(1);
  queue.setPaused(true);
  const caller = new AbortController();
  const cancelled = queue.run(caller.signal, async () => assert.fail("cancelled job must not run"));
  const rejected = assert.rejects(cancelled, { name: "AbortError" });
  caller.abort();
  await rejected;
  const failed = queue.run(undefined, async () => { throw new Error("translation failed"); });
  const failure = assert.rejects(failed, /translation failed/);
  const next = queue.run(undefined, async () => "next");
  queue.setPaused(false);
  await failure;
  assert.equal(await next, "next");
});
