import assert from "node:assert/strict";
import test from "node:test";
import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";
import { createTestDocument as createDocumentFromAnalysis, type FixtureLayout as EditorAnalysis } from "@/lib/content-jobs/editor/tests/fixtures";
import { resolveEditorSelection } from "./editor-selection";

const analysis: EditorAnalysis = {
  elements: [{
    id: "title", name: "제목", role: "본문 제목", kind: "text", frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
    style: { color: "#111111", backgroundColor: "transparent", fontSize: 36, lineHeight: 1.2, fontWeight: 700,
      textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "cover" },
  }],

  slides: [
    { imageId: "image-1", role: "hook", backgroundColor: "#FFFFFF", elementIds: [], visuals: [] },
    { imageId: "image-2", role: "body", backgroundColor: "#FFFFFF", elementIds: ["title"], visuals: [] },
    { imageId: "image-3", role: "body", backgroundColor: "#FFFFFF", elementIds: ["title"], visuals: [] },
    { imageId: "image-4", role: "cta", backgroundColor: "#FFFFFF", elementIds: [], visuals: [] },
  ],
};

test("선택한 장의 첫 일반 Element와 공유 범위를 찾는다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const selection = resolveEditorSelection(document, "slide-2", null, null);
  assert.equal(selection.element?.id, "title");
  assert.deepEqual(selection.appliedSlides.map((slide) => slide.slideId), ["slide-2", "slide-3"]);
  assert.deepEqual(selection.selectedSlideIds, ["slide-2", "slide-3"]);
  assert.deepEqual(selection.scopeSlides.map((slide) => slide.hasElement), [false, true, true, false]);
  assert.equal(selection.visualTargets.length, 2);
});

test("일반 Element가 없는 장에서는 공통 배경을 고르고 현재 장만 적용한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const selection = resolveEditorSelection(document, "slide-1", null, null);
  assert.equal(selection.element?.id, BACKGROUND_ELEMENT_ID);
  assert.deepEqual(selection.selectedSlideIds, ["slide-1"]);
});

test("Element가 없는 장도 복제 범위에 선택할 수 있다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const placementId = document.slides[1].placements[0].id;
  const selection = resolveEditorSelection(document, "slide-2", placementId,
    { key: `slide-2:${placementId}`, slideIds: ["slide-2", "slide-3", "slide-4"] });
  assert.deepEqual(selection.selectedSlideIds, ["slide-2", "slide-3", "slide-4"]);
  assert.equal(selection.visualTargets.length, 2);
});

test("슬라이드를 바꾸면 이전 범위를 가져오지 않고 Element가 있는 장만 기본 선택한다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const initial = resolveEditorSelection(document, "slide-2", null, null);
  const selection = resolveEditorSelection(document, "slide-3", null,
    { key: initial.scopeKey, slideIds: document.slides.map((slide) => slide.id) });
  assert.deepEqual(selection.selectedSlideIds, ["slide-2", "slide-3"]);
});

test("사용자가 현재 장만 선택하면 같은 Element가 있는 다른 장을 추가하지 않는다", () => {
  const document = createDocumentFromAnalysis(analysis, "repeating", 4, "9:16");
  const initial = resolveEditorSelection(document, "slide-2", null, null);
  const selection = resolveEditorSelection(document, "slide-2", initial.placement!.id,
    { key: initial.scopeKey, slideIds: ["slide-2"] });
  assert.deepEqual(selection.selectedSlideIds, ["slide-2"]);
});
