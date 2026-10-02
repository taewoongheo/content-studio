import assert from "node:assert/strict";
import test from "node:test";
import { editorShortcut } from "./editor-shortcut";

const event = { key: "z", code: "KeyZ", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, repeat: false };

test("Cmd+Z는 한글 입력 상태에서도 되돌리기로 해석한다", () => {
  assert.equal(editorShortcut(event, false), "undo");
  assert.equal(editorShortcut({ ...event, key: "ㅋ" }, false), "undo");
  assert.equal(editorShortcut({ ...event, metaKey: false, ctrlKey: true }, false), "undo");
});

test("입력칸의 native undo와 Shift+Cmd+Z 및 반복 키는 가로채지 않는다", () => {
  assert.equal(editorShortcut(event, true), null);
  assert.equal(editorShortcut({ ...event, shiftKey: true }, false), null);
  assert.equal(editorShortcut({ ...event, repeat: true }, false), null);
  assert.equal(editorShortcut({ ...event, metaKey: false }, false), null);
  assert.equal(editorShortcut({ ...event, altKey: true }, false), null);
});

test("기존 복사·붙여넣기 단축키를 그대로 제공한다", () => {
  assert.equal(editorShortcut({ ...event, code: "KeyC", key: "ㅊ" }, false), "copy");
  assert.equal(editorShortcut({ ...event, code: "KeyV", key: "ㅍ" }, false), "paste");
});

test("채팅·제안의 텍스트가 선택되면 시스템 복사·붙여넣기를 가로채지 않는다", () => {
  for (const code of ["KeyC", "KeyV"]) {
    assert.equal(editorShortcut({ ...event, code }, false, true), null);
    assert.equal(editorShortcut({ ...event, code, metaKey: false, ctrlKey: true }, false, true), null);
    assert.equal(editorShortcut({ ...event, code }, true, false), null);
  }
});

test("텍스트 선택이 없어야 Element 복사·붙여넣기가 동작하고 undo는 유지한다", () => {
  assert.equal(editorShortcut({ ...event, code: "KeyC" }, false, false), "copy");
  assert.equal(editorShortcut({ ...event, code: "KeyV" }, false, false), "paste");
  assert.equal(editorShortcut(event, false, true), "undo");
});
