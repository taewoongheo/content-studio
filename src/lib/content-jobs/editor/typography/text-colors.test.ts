import assert from "node:assert/strict";
import test from "node:test";
import { remapTextColors, setTextColor, validTextColors } from "./text-colors";
import { applyEditorCommands, createBlankDocument } from "../document";
import { makeElementDefinition } from "../elements/factory";
import { copyElement, pasteElement } from "@/screens/editor/components/clipboard/element-clipboard";

test("부분 색상을 덮어쓰고 선택 영역만 해제하며 인접한 같은 색상을 합친다", () => {
  const red = [{ start: 0, end: 5, color: "#FF0000" }];
  const replaced = setTextColor("ABCDE", red, 1, 4, "#0000FF");
  assert.deepEqual(replaced, [{ ...red[0], end: 1 }, { start: 1, end: 4, color: "#0000FF" }, { ...red[0], start: 4 }]);
  assert.deepEqual(setTextColor("ABCDE", replaced, 1, 4, "#FF0000"), red);
  assert.deepEqual(setTextColor("ABCDE", red, 1, 4, null), [{ ...red[0], end: 1 }, { ...red[0], start: 4 }]);
});

test("텍스트 삽입·삭제·교체 시 색상을 보정하고 여러 색상을 가로지르는 교체는 기본색을 쓴다", () => {
  const ranges = [{ start: 6, end: 11, color: "#FF0000" }];
  assert.deepEqual(remapTextColors("BUILD CHEST", "BIG BUILD CHEST", ranges), [{ ...ranges[0], start: 10, end: 15 }]);
  assert.deepEqual(remapTextColors("BUILD CHEST", "BUILD CHXEST", ranges), [{ ...ranges[0], end: 12 }]);
  assert.deepEqual(remapTextColors("BUILD CHEST", "BUILD CST", ranges), [{ ...ranges[0], end: 9 }]);
  assert.deepEqual(remapTextColors("BUILD CHEST", "BUILD ARMS", ranges), [{ ...ranges[0], end: 10 }]);
  assert.deepEqual(remapTextColors("RED BLUE", "GREEN", [
    { start: 0, end: 3, color: "#FF0000" }, { start: 4, end: 8, color: "#0000FF" },
  ]), []);
});

test("이모지와 결합 문자 안쪽의 구간을 거부하고 UI 선택은 전체 글자로 확장한다", () => {
  const value = "A👨‍👩‍👧‍👦e\u0301Z";
  assert.equal(validTextColors(value, [{ start: 1, end: 2, color: "#FF0000" }]), false);
  const ranges = setTextColor(value, [], 2, 3, "#FF0000");
  assert.equal(validTextColors(value, ranges), true);
  assert.equal(value.slice(ranges[0].start, ranges[0].end), "👨‍👩‍👧‍👦");
  assert.deepEqual(remapTextColors("e", "e\u0301", [{ start: 0, end: 1, color: "#FF0000" }]), [{ start: 0, end: 2, color: "#FF0000" }]);
  assert.equal(validTextColors("ABCDE", [{ start: 0, end: 3, color: "#FF0000" }, { start: 2, end: 5, color: "#0000FF" }]), false);
});

test("부분 색상은 텍스트 배치에 저장되고 내용 없는 장 복제는 색상도 초기화하며 클립보드는 보존한다", () => {
  const base = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  const colored = applyEditorCommands(base, [
    { type: "add_element", element: makeElementDefinition({ id: "title", kind: "text" }) },
    { type: "place_element", slideId: "slide-1", placementId: "title-1", elementId: "title" },
    { type: "set_slot_value", slideId: "slide-1", placementId: "title-1", value: "BUILD CHEST" },
    { type: "set_text_colors", slideId: "slide-1", placementId: "title-1", textColors: [{ start: 6, end: 11, color: "#FF0000" }] },
  ]);
  const copied = applyEditorCommands(colored, [{ type: "add_slide", sourceSlideId: "slide-1", afterSlideId: "slide-1", newSlideId: "empty", copyContent: false }]);
  assert.deepEqual(copied.slides[1].placements.find((p) => p.elementId === "title")?.textColors, []);
  const clipboard = copyElement(colored, "slide-1", "title-1", ["slide-1"])!;
  let counter = 0;
  const pasted = pasteElement(colored, clipboard, "slide-2", () => `pasted-${counter++}`)!;
  const next = applyEditorCommands(colored, pasted.commands);
  assert.deepEqual(next.slides[1].placements.find((p) => p.id === pasted.destinationPlacementId)?.textColors, [{ start: 6, end: 11, color: "#FF0000" }]);
  assert.throws(() => applyEditorCommands(colored, [{ type: "set_text_colors", slideId: "slide-1", placementId: "title-1",
    textColors: [{ start: 0, end: 100, color: "#FF0000" }] }]), /부분 색상/);
});
