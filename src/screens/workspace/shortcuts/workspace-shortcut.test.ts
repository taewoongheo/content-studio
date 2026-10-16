import assert from "node:assert/strict";
import test from "node:test";
import { adjacentTab, workspaceShortcut } from "./workspace-shortcut";

const event = { code: "BracketLeft", key: "[", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };

test("Cmd+[와 Cmd+]는 물리 키를 사용하고 추가 modifier는 제외한다", () => {
  assert.equal(workspaceShortcut({ ...event, key: "다른 입력" }), "previous");
  assert.equal(workspaceShortcut({ ...event, code: "BracketRight", key: "]" }), "next");
  assert.equal(workspaceShortcut({ ...event, code: undefined }), "previous");
  assert.equal(workspaceShortcut({ ...event, code: "KeyW", key: "ㅈ" }), "close");
  for (const modifier of ["ctrlKey", "altKey", "shiftKey"]) {
    assert.equal(workspaceShortcut({ ...event, [modifier]: true }), null);
  }
  assert.equal(workspaceShortcut({ ...event, metaKey: false }), null);
});

test("인접 탭은 표시 순서대로 이동하고 끝이나 사라진 탭에서는 이동하지 않는다", () => {
  const tabs = [{ tabId: "a" }, { tabId: "b" }, { tabId: "c" }];
  assert.equal(adjacentTab(tabs, "b", "previous"), tabs[0]);
  assert.equal(adjacentTab(tabs, "b", "next"), tabs[2]);
  assert.equal(adjacentTab(tabs, "a", "previous"), undefined);
  assert.equal(adjacentTab(tabs, "c", "next"), undefined);
  assert.equal(adjacentTab(tabs, "closed", "next"), undefined);
});
