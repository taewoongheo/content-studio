import assert from "node:assert/strict";
import test from "node:test";
import { defaultPlacement, defaultVisualSlides, selectVisualSlides, visualScopeLabel } from "./element-scope";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/document";
import type { EditorSlide } from "@/lib/content-jobs/editor/types";

const available = ["slide-2", "slide-3", "slide-4"];

test("페이지를 열면 첫 일반 Element를 고르고 없으면 배경을 고른다", () => {
  const background = { id: BACKGROUND_PLACEMENT_ID, elementId: BACKGROUND_ELEMENT_ID,
    value: "", frameOverride: null, styleOverride: null };
  const title = { ...background, id: "title-placement", elementId: "title" };
  const slide: EditorSlide = { id: "slide-1", role: "hook", backgroundColor: "#FFFFFF",
    placements: [background, title] };
  assert.equal(defaultPlacement(slide)?.id, title.id);
  assert.equal(defaultPlacement({ ...slide, placements: [background] })?.id, BACKGROUND_PLACEMENT_ID);
});

test("배경의 기본 적용 범위는 전체이고 다른 Element는 현재 장이다", () => {
  assert.deepEqual(defaultVisualSlides("background", "slide-2", available), available);
  assert.deepEqual(defaultVisualSlides("text", "slide-2", available), ["slide-2"]);
});

test("현재 장은 적용 범위에서 해제할 수 없다", () => {
  assert.deepEqual(selectVisualSlides("slide-3", available, ["slide-3"], { slideId: "slide-3", checked: false }), ["slide-3"]);
  assert.deepEqual(selectVisualSlides("slide-3", available, available, "current"), ["slide-3"]);
});

test("전체 및 장별 선택은 현재 장을 포함하고 사용하지 않는 장은 제외한다", () => {
  assert.deepEqual(selectVisualSlides("slide-3", available, ["slide-3"], "all"), available);
  assert.deepEqual(selectVisualSlides("slide-3", available, ["slide-3"], { slideId: "slide-4", checked: true }), ["slide-3", "slide-4"]);
  assert.deepEqual(selectVisualSlides("slide-3", available, available, { slideId: "slide-2", checked: false }), ["slide-3", "slide-4"]);
  assert.deepEqual(selectVisualSlides("slide-3", available, ["slide-3"], { slideId: "slide-1", checked: true }), ["slide-3"]);
});

test("적용 범위 이름은 현재·전체·일부를 구분한다", () => {
  assert.equal(visualScopeLabel(1, 3), "현재 장");
  assert.equal(visualScopeLabel(3, 3), "전체");
  assert.equal(visualScopeLabel(2, 3), "선택한 2장");
});
