import assert from "node:assert/strict";
import test from "node:test";
import { removalCommandsForScope, selectVisualSlides, visualScopeLabel } from "./element-scope";

const available = ["slide-2", "slide-3", "slide-4"];

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
  assert.equal(visualScopeLabel(1, 3), "현재 장만 적용 · 1/3장");
  assert.equal(visualScopeLabel(3, 3), "전체 적용 · 3/3장");
  assert.equal(visualScopeLabel(2, 3), "일부 적용 · 2/3장");
  assert.equal(visualScopeLabel(1, 1), "이 장에만 존재");
});

test("삭제는 선택한 장에 있는 해당 Element 배치에만 적용한다", () => {
  const targets = available.map((slideId, index) => ({ slideId, placement: { id: `p${index}`, elementId: "title",
    value: "", frameOverride: null, styleOverride: null } }));
  assert.deepEqual(removalCommandsForScope(targets, ["slide-2", "slide-4"]), [
    { type: "remove_placement", slideId: "slide-2", placementId: "p0" },
    { type: "remove_placement", slideId: "slide-4", placementId: "p2" },
  ]);
});
