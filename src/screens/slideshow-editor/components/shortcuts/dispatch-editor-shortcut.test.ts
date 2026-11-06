import assert from "node:assert/strict";
import test from "node:test";
import { dispatchEditorShortcut } from "./dispatch-editor-shortcut";

function keyEvent(code: string, overrides = {}) {
  return { code, key: "", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false,
    repeat: false, defaultPrevented: false,
    stopImmediatePropagation() {},
    preventDefault() { this.defaultPrevented = true; }, ...overrides };
}
const context = { editingText: false, hasSelectedText: false, dialogOpen: false };

test("처리한 단축키를 뒤의 다른 핸들러에서 중복 실행하지 않는다", () => {
  for (const dialogOpen of [false, true]) {
    const target = new EventTarget();
    let editorCalls = 0;
    let otherCalls = 0;
    target.addEventListener("keydown", event => {
      dispatchEditorShortcut(event as Event & ReturnType<typeof keyEvent>, { ...context, dialogOpen }, () => {
        editorCalls++;
        return true;
      });
    });
    target.addEventListener("keydown", () => { otherCalls++; });
    const event = Object.assign(new Event("keydown", { cancelable: true }), {
      code: "KeyD", key: "d", metaKey: true, ctrlKey: false,
      altKey: false, shiftKey: false, repeat: false,
    });
    target.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(editorCalls, dialogOpen ? 0 : 1);
    assert.equal(otherCalls, 0);
  }
});

test("앱 명령을 실행할 수 없어도 브라우저 기본 단축키는 차단한다", () => {
  for (const code of ["KeyD", "KeyS", "KeyZ", "KeyC", "KeyV"]) {
    for (const metaKey of [true, false]) {
      const event = keyEvent(code, { metaKey, ctrlKey: !metaKey });
      dispatchEditorShortcut(event, context, () => {
        assert.equal(event.defaultPrevented, true, "실행 전에 기본 동작을 차단해야 한다");
        return false;
      });
      assert.equal(event.defaultPrevented, true, code);
    }
  }
});

test("반복 키는 브라우저로 넘어가지 않고 앱 명령도 반복하지 않는다", () => {
  for (const code of ["KeyD", "KeyS", "KeyZ", "KeyC", "KeyV"]) {
    const event = keyEvent(code, { repeat: true });
    dispatchEditorShortcut(event, context, () => assert.fail("반복 실행"));
    assert.equal(event.defaultPrevented, true, code);
  }
});

test("대화상자는 저장·범위 토글만 예약하고 텍스트 편집은 유지한다", () => {
  for (const code of ["KeyD", "KeyS", "KeyZ", "KeyC", "KeyV"]) {
    const event = keyEvent(code);
    dispatchEditorShortcut(event, { ...context, dialogOpen: true }, () => assert.fail("대화상자 뒤 편집"));
    assert.equal(event.defaultPrevented, code === "KeyD" || code === "KeyS");
  }
  for (const code of ["KeyZ", "KeyC", "KeyV"]) {
    const event = keyEvent(code);
    dispatchEditorShortcut(event, { ...context, editingText: true }, () => assert.fail("입력 가로채기"));
    assert.equal(event.defaultPrevented, false);
  }
});

test("이미 처리된 키와 선택한 본문 복사는 가로채지 않는다", () => {
  const handled = keyEvent("KeyD", { defaultPrevented: true });
  dispatchEditorShortcut(handled, context, () => assert.fail("중복 실행"));
  const copy = keyEvent("KeyC");
  dispatchEditorShortcut(copy, { ...context, hasSelectedText: true }, () => assert.fail("본문 복사 가로채기"));
  assert.equal(copy.defaultPrevented, false);
});
