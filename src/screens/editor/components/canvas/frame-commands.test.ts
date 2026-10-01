import assert from "node:assert/strict";
import test from "node:test";
import { frameCommandsForScope, visualCommandsForScope } from "./frame-commands";

const frame = { x: 0.1, y: 0.2, width: 0.5, height: 0.4 };
const placement = (id: string) => ({ id, elementId: "title", value: "", frameOverride: null, styleOverride: null });
const targets = [
  { slideId: "slide-1", placement: placement("p1") },
  { slideId: "slide-2", placement: placement("p2") },
  { slideId: "slide-3", placement: placement("p3") },
];

test("전체 적용은 원본 Element의 레이아웃을 한 번만 갱신한다", () => {
  assert.deepEqual(frameCommandsForScope("title", frame, targets, ["slide-1", "slide-2", "slide-3"]),
    [{ type: "update_visual", scope: "common", elementId: "title", frame }]);
});

test("일부 적용은 선택한 장의 배치만 갱신한다", () => {
  assert.deepEqual(frameCommandsForScope("title", frame, targets, ["slide-1", "slide-3", "missing"]), [
    { type: "update_visual", scope: "local", slideId: "slide-1", placementId: "p1", frame },
    { type: "update_visual", scope: "local", slideId: "slide-3", placementId: "p3", frame },
  ]);
  assert.deepEqual(frameCommandsForScope("title", frame, targets, ["missing"]), []);
});

test("텍스트 크기 조절은 프레임과 글자 크기를 같은 적용 범위에 저장한다", () => {
  assert.deepEqual(visualCommandsForScope("title", frame, { fontSize: 54 }, targets, ["slide-1", "slide-2", "slide-3"]), [
    { type: "update_visual", scope: "common", elementId: "title", frame, style: { fontSize: 54 } },
  ]);
});
