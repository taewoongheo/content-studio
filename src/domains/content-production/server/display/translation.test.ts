import test from "node:test";
import assert from "node:assert/strict";
import { createDisplayTranslator } from "./translation";

test("display translation preserves canonical values and identifiers, deduplicates concurrent requests", async () => {
  let calls = 0;
  const translate = createDisplayTranslator(async strings => {
    calls++;
    assert.deepEqual(strings, ["Use 3 sets", "Save this plan"]);
    return ["3세트를 수행한다", "이 계획을 저장한다"];
  });
  const source = { answer: "Use 3 sets", sources: [{ id: "log-123", url: "https://example.com", used_for: "Save this plan" }] };
  const before = structuredClone(source);
  const [a, b] = await Promise.all([translate(source), translate(source)]);
  assert.equal(calls, 1);
  assert.deepEqual(source, before);
  assert.deepEqual(a, { answer: "3세트를 수행한다", sources: [{ id: "log-123", url: "https://example.com", used_for: "이 계획을 저장한다" }] });
  assert.deepEqual(a, b);
});

test("reject incomplete or altered-number translations and allow retry", async () => {
  let calls = 0;
  const translate = createDisplayTranslator(async () => ++calls === 1 ? ["4세트를 수행한다"] : ["3세트를 수행한다"]);
  await assert.rejects(translate({ answer: "Use 3 sets" }), /수치/);
  assert.deepEqual(await translate({ answer: "Use 3 sets" }), { answer: "3세트를 수행한다" });
});

test("cache keys and CLI requests use the same selected model", async () => {
  const models: string[] = [];
  const translate = createDisplayTranslator(async (_strings, _signal, model) => {
    models.push(model);
    return ["3세트를 수행한다"];
  });
  const source = { answer: "Use 3 sets" };
  await translate(source, "model-a");
  await translate(source, "model-a");
  await translate(source, "model-b");
  assert.deepEqual(models, ["model-a", "model-b"]);
});

test("sentence cache translates only changed sentences and reuses duplicates across scopes", async () => {
  const calls: string[][] = [];
  const translate = createDisplayTranslator(async strings => {
    calls.push(strings);
    return strings.map(text => text.startsWith("Use") ? "3세트를 수행한다." : text.includes("90") ? "90초 쉰다." : "60초 쉰다.");
  });
  const source = { analysis: "Use 3 sets. Rest 60 seconds.\n", answer: "Use 3 sets." };
  const result = await translate(source);
  assert.deepEqual(result, { analysis: "3세트를 수행한다. 60초 쉰다.\n", answer: "3세트를 수행한다." });
  await translate({ analysis: "Use 3 sets. Rest 90 seconds.\n" });
  assert.deepEqual(calls, [["Use 3 sets.", "Rest 60 seconds."], ["Rest 90 seconds."]]);
  assert.equal(source.analysis, "Use 3 sets. Rest 60 seconds.\n");
});

test("cancelling one viewer keeps a shared CLI request alive for another viewer", async () => {
  let finish!: (value: string[]) => void;
  let worker!: AbortSignal;
  const translate = createDisplayTranslator(async (_strings, signal) => {
    worker = signal;
    return new Promise<string[]>(resolve => { finish = resolve; });
  });
  const controller = new AbortController();
  const a = translate({ answer: "Use 3 sets" }, "model", controller.signal);
  const b = translate({ answer: "Use 3 sets" }, "model");
  await Promise.resolve();
  controller.abort(new DOMException("Closed", "AbortError"));
  await assert.rejects(a, { name: "AbortError" });
  assert.equal(worker.aborted, false);
  finish(["3세트를 수행한다"]);
  assert.deepEqual(await b, { answer: "3세트를 수행한다" });
});

test("last viewer cancellation stops the worker and a subsequent request can retry", async () => {
  let calls = 0;
  let worker!: AbortSignal;
  const translate = createDisplayTranslator(async (_strings, signal) => {
    calls++; worker = signal;
    if (calls > 1) return ["3세트를 수행한다"];
    return new Promise<string[]>((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
  });
  const controller = new AbortController();
  const a = translate({ answer: "Use 3 sets" }, "model", controller.signal);
  await Promise.resolve();
  controller.abort(new DOMException("Closed", "AbortError"));
  await assert.rejects(a, { name: "AbortError" });
  assert.equal(worker.aborted, true);
  assert.deepEqual(await translate({ answer: "Use 3 sets" }, "model"), { answer: "3세트를 수행한다" });
  assert.equal(calls, 2);
});
