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
