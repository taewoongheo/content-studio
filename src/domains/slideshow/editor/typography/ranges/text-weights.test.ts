import assert from "node:assert/strict";
import test from "node:test";
import { remapTextWeights, setTextWeight, styledTextParts, validTextWeights } from "@/domains/slideshow/editor/typography/ranges/text-weights";
import { applyEditorCommands, createBlankDocument } from "@/domains/slideshow/editor/document";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { copyElement, pasteElement } from "@/screens/slideshow-editor/components/clipboard/element-clipboard";
import { validateEditorCommands } from "@/domains/slideshow/editor/schema";

test("굵기는 선택 영역을 덮어쓰고 해제하며 유니코드 글자 경계를 지킨다", () => {
  const bold = [{ start: 0, end: 5, fontWeight: 700 }];
  const split = setTextWeight("ABCDE", bold, 1, 4, 500);
  assert.deepEqual(split, [{ start: 0, end: 1, fontWeight: 700 }, { start: 1, end: 4, fontWeight: 500 }, { start: 4, end: 5, fontWeight: 700 }]);
  assert.deepEqual(setTextWeight("ABCDE", split, 1, 4, 700), bold);
  assert.deepEqual(setTextWeight("ABCDE", bold, 1, 4, null), [{ start: 0, end: 1, fontWeight: 700 }, { start: 4, end: 5, fontWeight: 700 }]);
  const text = "A👨‍👩‍👧‍👦e\u0301Z";
  assert.equal(validTextWeights(text, [{ start: 1, end: 2, fontWeight: 700 }]), false);
  assert.equal(validTextWeights(text, setTextWeight(text, [], 2, 3, 700)), true);
  for (const fontWeight of [99, 901, 700.5, NaN]) assert.equal(validTextWeights("ABC", [{ start: 0, end: 3, fontWeight }]), false);
  assert.equal(validTextWeights("ABC", [{ start: 0, end: 2, fontWeight: 700 }, { start: 1, end: 3, fontWeight: 500 }]), false);
  assert.deepEqual(remapTextWeights("BUILD CHEST", "BIG BUILD CHEST", [{ start: 6, end: 11, fontWeight: 700 }]), [{ start: 10, end: 15, fontWeight: 700 }]);
  assert.deepEqual(remapTextWeights("ABCDE", "ABxCDE", bold), [{ start: 0, end: 6, fontWeight: 700 }]);
});

test("색상과 굵기는 교차 구간에서도 서로 독립적이다", () => {
  assert.deepEqual(styledTextParts("ABCDE", [{ start: 1, end: 4, color: "#FF0000" }], [{ start: 2, end: 5, fontWeight: 700 }]), [
    { text: "A", color: undefined, fontWeight: undefined }, { text: "B", color: "#FF0000", fontWeight: undefined },
    { text: "CD", color: "#FF0000", fontWeight: 700 }, { text: "E", color: undefined, fontWeight: 700 },
  ]);
});

test("명령·내용 수정·빈 장 복제·클립보드가 부분 굵기를 보존한다", () => {
  const base = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  const command = { type: "set_slot_value" as const, slideId: "slide-1", placementId: "title-1", value: "BUILD CHEST",
    textWeights: [{ start: 6, end: 11, fontWeight: 700 }], textColors: [{ start: 6, end: 11, color: "#FF0000" }] };
  assert.equal(validateEditorCommands({ commands: [command] }).ok, true);
  const doc = applyEditorCommands(base, [
    { type: "add_element", element: makeElementDefinition({ id: "title", kind: "text" }) },
    { type: "place_element", slideId: "slide-1", elementId: "title", placementId: "title-1" }, command,
  ]);
  const changed = applyEditorCommands(doc, [{ type: "set_slot_value", slideId: "slide-1", placementId: "title-1", value: "BUILD BIG CHEST" }]);
  assert.deepEqual(changed.slides[0].placements.find(p => p.id === "title-1")?.textWeights, [{ start: 10, end: 15, fontWeight: 700 }]);
  const empty = applyEditorCommands(doc, [{ type: "add_slide", sourceSlideId: "slide-1", afterSlideId: "slide-1", newSlideId: "empty", copyContent: false }]);
  assert.deepEqual(empty.slides[1].placements.find(p => p.elementId === "title")?.textWeights, []);
  const clipboard = copyElement(doc, "slide-1", "title-1", ["slide-1"])!;
  let count = 0;
  const pasted = pasteElement(doc, clipboard, "slide-2", () => `copy-${count++}`)!;
  const next = applyEditorCommands(doc, pasted.commands);
  assert.deepEqual(next.slides[1].placements.find(p => p.id === pasted.destinationPlacementId)?.textWeights, command.textWeights);
  assert.throws(() => applyEditorCommands(doc, [{ type: "set_text_weights", slideId: "slide-1", placementId: "title-1", textWeights: [{ start: 0, end: 999, fontWeight: 700 }] }]), /부분 굵기/);
  const clear = applyEditorCommands(doc, [{ type: "set_text_weights", slideId: "slide-1", placementId: "title-1", textWeights: [] }]);
  assert.deepEqual(clear.slides[0].placements.find(p => p.id === "title-1")?.textColors, command.textColors);
});
