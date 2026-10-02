import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorCommand, applyEditorCommands, ensureSharedBackground } from "@/lib/content-jobs/editor/document";
import { makeElementDefinition } from "@/lib/content-jobs/editor/elements/factory";
import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { clipboardShortcut, copyElement, pasteElement } from "./element-clipboard";
import { frameCommandsForScope } from "../canvas/frame/commands";

function fixture() {
  const element = makeElementDefinition({ kind: "rectangle", id: "shape", sourceImageId: "image-1" });
  const document: EditorDocument = { version: 1, structure: "sequential", aspectRatio: "4:5",
    formatNotes: { visualRules: "기본", writingStyle: "기본", hookPattern: "기본", bodyProgression: "기본" }, elements: [element],
    slides: ["a", "b", "c"].map((id) => ({ id, role: "body", backgroundColor: "#FFFFFF", placements: id === "c" ? [] : [{
      id: `p-${id}`, elementId: element.id, value: id, frameOverride: null,
      styleOverride: { backgroundColor: id === "a" ? "#FF0000" : "#0000FF" },
    }] })) };
  return ensureSharedBackground(document);
}

test("전체 범위 붙여넣기는 없는 장에도 하나의 새 공유 Element를 만들고 원본과 장별 스타일을 보존한다", () => {
  const document = fixture();
  const clipboard = copyElement(document, "a", "p-a", ["a", "b", "c"])!;
  let counter = 0;
  const pasted = pasteElement(document, clipboard, "c", () => `new-${counter++}`)!;
  const next = applyEditorCommands(document, pasted.commands);
  assert.ok(next.slides.every((slide) => slide.placements.some((placement) => placement.elementId === "new-0")));
  assert.equal(next.slides[1].placements.find((placement) => placement.elementId === "new-0")?.styleOverride?.backgroundColor, "#0000FF");
  assert.equal(next.slides[2].placements.find((placement) => placement.id === pasted.destinationPlacementId)?.value, "a");
  assert.deepEqual(document, fixture());
});

test("현재 장 범위는 다른 장에 붙여넣을 때 목적지에만 추가하고 복사 시점 값을 보관한다", () => {
  const document = fixture();
  const clipboard = copyElement(document, "a", "p-a", ["a"])!;
  const modified = applyEditorCommand(document, { type: "set_slot_value", slideId: "a", placementId: "p-a", value: "changed" });
  let counter = 0;
  const pasted = pasteElement(modified, clipboard, "c", () => `local-${counter++}`)!;
  const next = applyEditorCommands(modified, pasted.commands);
  assert.equal(next.slides[0].placements.some((placement) => placement.elementId === "local-0"), false);
  assert.equal(next.slides[2].placements.find((placement) => placement.id === pasted.destinationPlacementId)?.value, "a");
  assert.equal(pasteElement(document, clipboard, "missing", () => "unused"), null);
  assert.equal(copyElement(document, "a", "__background-placement__", ["a"]), null);
});

test("일부 범위는 선택한 장과 붙여넣는 장에만 추가한다", () => {
  const document = fixture();
  const clipboard = copyElement(document, "a", "p-a", ["a", "b"])!;
  let counter = 0;
  const pasted = pasteElement(document, clipboard, "c", () => `partial-${counter++}`)!;
  const next = applyEditorCommands(document, pasted.commands);
  assert.ok(next.slides.every((slide) => slide.placements.some((placement) => placement.elementId === "partial-0")));
});

test("전체 장 선택의 스타일 이동은 없는 장에 배치를 추가하지 않는다", () => {
  const document = fixture();
  const targets = document.slides.flatMap((slide) => slide.placements.filter((placement) => placement.elementId === "shape")
    .map((placement) => ({ slideId: slide.id, placement })));
  const commands = frameCommandsForScope("shape", { x: 0.2, y: 0.2, width: 0.3, height: 0.3 }, targets, ["a", "b", "c"]);
  const next = applyEditorCommands(document, commands);
  assert.equal(next.slides[2].placements.some((placement) => placement.elementId === "shape"), false);
});

test("단축키는 Ctrl/Cmd를 지원하고 텍스트 입력 및 반복 키는 건드리지 않는다", () => {
  const event = { key: "c", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, repeat: false };
  assert.equal(clipboardShortcut(event, false), "copy");
  assert.equal(clipboardShortcut({ ...event, key: "V", ctrlKey: false, metaKey: true }, false), "paste");
  assert.equal(clipboardShortcut(event, true), null);
  assert.equal(clipboardShortcut({ ...event, repeat: true }, false), null);
  assert.equal(clipboardShortcut({ ...event, ctrlKey: false }, false), null);
});
