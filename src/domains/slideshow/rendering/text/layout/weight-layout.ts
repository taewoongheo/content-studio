import type { TextWeightRange } from "@/domains/slideshow/editor/types";

export type WeightRun = { text: string; start: number; end: number; fontWeight: number; width: number };
export type WeightLine = { runs: WeightRun[]; width: number };

/** Measure entire weight runs so color changes never change shaping or wrapping. */
export function weightRuns(source: string, start: number, end: number, weights: TextWeightRange[], baseWeight: number,
  measure: (text: string, weight: number) => number): WeightRun[] {
  const points = [...new Set([start, end, ...weights.flatMap(r => [r.start, r.end]).filter(p => p > start && p < end)])].sort((a, b) => a - b);
  const runs: WeightRun[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const fontWeight = weights.find(r => r.start <= a && r.end > a)?.fontWeight ?? baseWeight;
    const last = runs.at(-1);
    if (last?.fontWeight === fontWeight) {
      last.end = b;
      last.text = source.slice(last.start, b);
      last.width = measure(last.text, fontWeight);
    } else {
      const text = source.slice(a, b);
      runs.push({ text, start: a, end: b, fontWeight, width: measure(text, fontWeight) });
    }
  }
  return runs;
}

export function layoutWeightedText(source: string, weights: TextWeightRange[], baseWeight: number, maxWidth: number,
  measure: (text: string, weight: number) => number): WeightLine[] {
  const lines: WeightLine[] = [];
  const runsFor = (start: number, end: number) => weightRuns(source, start, end, weights, baseWeight, measure);
  const widthOf = (start: number, end: number) => runsFor(start, end).reduce((sum, run) => sum + run.width, 0);
  let start = 0, end = 0;
  function finish(trim: boolean) {
    const visibleEnd = trim ? end - (source.slice(start, end).match(/\s+$/u)?.[0].length ?? 0) : end;
    const runs = runsFor(start, visibleEnd);
    lines.push({ runs, width: runs.reduce((sum, run) => sum + run.width, 0) });
  }
  for (const token of source.matchAll(/\n|[^\S\n]+|[^\s]+/gu)) {
    const tokenStart = token.index, tokenEnd = tokenStart + token[0].length;
    if (token[0] === "\n") { finish(false); start = end = tokenEnd; continue; }
    if (token[0].trim() && end > start && widthOf(start, tokenEnd) > maxWidth) {
      finish(true); start = end = tokenStart;
    }
    // Split oversized words only at grapheme boundaries (emoji and combining marks stay intact).
    if (token[0].trim() && widthOf(start, tokenEnd) > maxWidth) {
      for (const part of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(token[0])) {
        const nextEnd = tokenStart + part.index + part.segment.length;
        if (end > start && widthOf(start, nextEnd) > maxWidth) { finish(false); start = end; }
        end = nextEnd;
      }
    } else { end = tokenEnd; }
  }
  finish(false);
  return lines;
}
