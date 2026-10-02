import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument } from "@/lib/content-jobs/editor/document";
import { applyEditorCommands, BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/document";
import { frontToBack, reorderLayerCommands } from "./layer-order";

function documentWithLayers() {
  const document = applyEditorCommands(createBlankDocument({ structure: "repeating", aspectRatio: "4:5", slideCount: 4 }), [
 { type: "add_element", element: { id: "title", name: "제목", role: "제목", kind: "text", frame: {x: 0,y: 0,width: 50,height: 10}, style: { ...createBlankDocument({structure:"repeating",aspectRatio:"4:5",slideCount:4}).elements[0].style } } },
 {type:"place_element",slideId:"slide-2",elementId:"title",placementId:"title-2"},
 {type:"place_element",slideId:"slide-3",elementId:"title",placementId:"title-3"}
 ]);
  return applyEditorCommands(document, [
    { type: "add_element", element: { ...document.elements.find(element => element.id === "title")!, id: "extra", kind: "text" } },
    { type: "place_element", slideId: "slide-2", elementId: "extra", placementId: "extra-2" },
    { type: "place_element", slideId: "slide-3", elementId: "extra", placementId: "extra-3" },
  ]);
}

test("세로 목록 위쪽 Element는 렌더 순서 끝에 위치하고 배경은 고정된다", () => {
  const document = documentWithLayers();
  const slide = document.slides[1];
  const order = frontToBack(slide);
  assert.equal(order[0].id, "extra-2");
  const commands = reorderLayerCommands(document, slide.id, order[1].id, order[0].id, [slide.id]);
  const after = applyEditorCommands(document, commands);
  assert.equal(frontToBack(after.slides[1])[0].id, order[1].id);
  assert.equal(after.slides[1].placements.at(-1)?.id, BACKGROUND_PLACEMENT_ID);
  assert.deepEqual(after.slides[2], document.slides[2]);
  assert.equal(frontToBack(document.slides[1])[0].id, "extra-2");
});

test("적용 범위의 다른 장에도 공유 Element의 상대 순서를 반영한다", () => {
  const document = documentWithLayers();
  const order = frontToBack(document.slides[1]);
  const commands = reorderLayerCommands(document, "slide-2", order[1].id, order[0].id, ["slide-2", "slide-3"]);
  const after = applyEditorCommands(document, commands);
  assert.equal(commands.length, 2);
  assert.equal(frontToBack(after.slides[1])[0].elementId, order[1].elementId);
  assert.equal(frontToBack(after.slides[2])[0].elementId, order[1].elementId);
});

test("배경·없는 배치·같은 위치의 이동은 무시한다", () => {
  const document = documentWithLayers();
  assert.deepEqual(reorderLayerCommands(document, "slide-2", BACKGROUND_PLACEMENT_ID, "extra-2", ["slide-2"]), []);
  assert.deepEqual(reorderLayerCommands(document, "slide-2", "extra-2", BACKGROUND_PLACEMENT_ID, ["slide-2"]), []);
  assert.deepEqual(reorderLayerCommands(document, "slide-2", "missing", "extra-2", ["slide-2"]), []);
  assert.deepEqual(reorderLayerCommands(document, "slide-2", "extra-2", "extra-2", ["slide-2"]), []);
});
