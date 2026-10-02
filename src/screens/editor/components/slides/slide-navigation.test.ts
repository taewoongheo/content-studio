import assert from "node:assert/strict";
import test from "node:test";
import { readyJob } from "@/lib/content-jobs/editor/workflow/orchestration/tests/fixtures";
import { reorderedSlideIds, slideLabel } from "./slide-navigation";

test("모든 역할의 드래그는 ID를 보존한다", () => {
  const document = readyJob().job.editor.document!;
  assert.deepEqual(reorderedSlideIds(document, "slide-2", "slide-3"), ["slide-1", "slide-3", "slide-2", "slide-4"]);
  assert.deepEqual(reorderedSlideIds(document, "slide-1", "slide-2"), ["slide-2", "slide-1", "slide-3", "slide-4"]);
  assert.deepEqual(reorderedSlideIds(document, "slide-4", "slide-1"), ["slide-4", "slide-1", "slide-2", "slide-3"]);
  assert.equal(reorderedSlideIds(document, "missing", "slide-2"), null);
  assert.equal(reorderedSlideIds(document, "slide-2", "slide-2"), null);
  assert.equal(document.slides[1].id, "slide-2");
});

test("비반복형은 모든 장을 이동하고 이름은 순번과 독립적이다", () => {
  const document = readyJob().job.editor.document!;
  document.structure = "sequential";
  document.slides[0].name = "시작 페이지";
  assert.deepEqual(reorderedSlideIds(document, "slide-1", "slide-4"), ["slide-2", "slide-3", "slide-4", "slide-1"]);
  assert.equal(slideLabel(document.slides[0], 3), "4장 · 시작 페이지");
  assert.equal(slideLabel(document.slides[1], 0), "1장 · 본문");
});
