import assert from "node:assert/strict";
import test from "node:test";
import { lineColorStops, sourceLineOffsets } from "./color-layout";

test("자동 줄바꿈의 생략된 공백과 명시적 빈 줄에서도 원문 색상 위치를 찾는다", () => {
  assert.deepEqual(sourceLineOffsets("BUILD   CHEST\n\nBUILD CHEST", [
    { text: "BUILD", lastInParagraph: false }, { text: "CHEST", lastInParagraph: true },
    { text: "", lastInParagraph: true }, { text: "BUILD CHEST", lastInParagraph: true },
  ]), [0, 8, 14, 15]);
});

test("여러 줄에 걸친 색상은 전체 줄 측정을 사용하고 기본색과 지정색을 급격하게 전환한다", () => {
  assert.deepEqual(lineColorStops("CHEST", 6, [{ start: 6, end: 9, color: "#FF0000" }], "#111111", (text) => text.length * 10),
    [0, "#111111", 0, "#111111", 0, "#FF0000", 0.6, "#FF0000", 0.6, "#111111", 1, "#111111"]);
  assert.equal(lineColorStops("BUILD", 0, [{ start: 6, end: 11, color: "#FF0000" }], "#111111", (text) => text.length), null);
});
