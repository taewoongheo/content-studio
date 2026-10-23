import assert from "node:assert/strict";
import test from "node:test";
import { displayContent, displayContentKey, applyCanvasTranslation } from "./display";

test("canvas projection excludes full analysis, research and slide copy; merges keep canonical slide data", () => {
  const context = { topic: "Arms", answer: "Use 3 sets", analysis: "Very long analysis", research: [{ finding: "Long research" }],
    content: { hook: "Build your arms", slides: [{ slide_id: "one", copy: ["Use 3 sets"] }] }, sources: [{ url: "https://example.com" }], review: "Long review ".repeat(100) };
  const before = structuredClone(context);
  const projection = displayContent(context, "canvas");
  assert.equal(projection.analysis, undefined);
  assert.equal(projection.research, undefined);
  assert.equal(projection.sources, undefined);
  assert.deepEqual(projection.content, { hook: "Build your arms" });
  assert.ok(String(projection.review).length < 410);
  assert.equal(displayContentKey({ ...context, analysis: "Changed research only" }, "canvas"), displayContentKey(context, "canvas"));
  assert.notEqual(displayContentKey({ ...context, answer: "Use 4 sets" }, "canvas"), displayContentKey(context, "canvas"));
  const translated = applyCanvasTranslation(context, { content: { hook: "팔을 키우세요" } });
  assert.deepEqual((translated.content as typeof context.content).slides, context.content.slides);
  assert.deepEqual(context, before);
  assert.equal(displayContent(context).analysis, context.analysis);
});
