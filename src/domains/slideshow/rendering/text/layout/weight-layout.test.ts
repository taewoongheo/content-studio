import assert from "node:assert/strict";
import test from "node:test";
import { layoutWeightedText, weightRuns } from "@/domains/slideshow/rendering/text/layout/weight-layout";

const measure = (text: string, weight: number) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length * (weight === 700 ? 20 : 10);
test("굵은 글자 실제 폭으로 줄바꿈하고 같은 굵기의 연속 구간을 한 번에 측정한다", () => {
  const bold = [{ start: 3, end: 5, fontWeight: 700 }];
  assert.deepEqual(layoutWeightedText("AA BB", bold, 400, 65, measure).map(l => l.runs.map(r => r.text).join("")), ["AA", "BB"]);
  assert.equal(layoutWeightedText("AA BB", [], 400, 65, measure).length, 1);
  assert.deepEqual(weightRuns("AVATAR", 0, 6, [{ start: 0, end: 3, fontWeight: 700 }, { start: 3, end: 6, fontWeight: 700 }], 400,
    (text) => text === "AVATAR" ? 55 : text.length * 10), [{ text: "AVATAR", start: 0, end: 6, fontWeight: 700, width: 55 }]);
});
test("명시적 빈 줄·넘치는 단어·이모지의 원문 위치를 유지한다", () => {
  const source = "A\n\n👨‍👩‍👧‍👦e\u0301BC";
  const lines = layoutWeightedText(source, [], 400, 20, measure);
  assert.deepEqual(lines.map(l => l.runs.map(r => r.text).join("")), ["A", "", "👨‍👩‍👧‍👦e\u0301", "BC"]);
  for (const line of lines) for (const run of line.runs) assert.equal(source.slice(run.start, run.end), run.text);
});
