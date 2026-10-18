import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { inspectSlideshow, summarizeSlideshow } from "./read";
test("슬라이드 부분 조회는 필요한 정의와 최신 revision을 유지하며 원본을 바꾸지 않는다", () => {
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 6, outputLanguage: "English" });
  assert.deepEqual(inspectSlideshow(job), job);
  const selected = inspectSlideshow(job, { slideIds: ["slide-2"], includeAssets: false });
  assert.ok("editor" in selected && selected.editor); assert.equal(selected.editor.document.slides.length, 1);
  assert.equal(selected.editor.document.slides[0].id, "slide-2"); assert.equal(selected.partial, true);
  assert.equal("assets" in selected, false);
  const outline = inspectSlideshow(job, { outline: true }); assert.ok("slides" in outline && outline.slides);
  assert.equal(outline.slides.length, 6); assert.equal("editor" in outline, false);
  assert.equal("editor" in summarizeSlideshow(job), false);
  assert.throws(() => inspectSlideshow(job, { slideIds: ["missing"] }), /missing/);
  assert.equal(registry.get(job.id).editor.document.slides.length, 6);
});
