import type { TextColorRange } from "@/lib/content-jobs/editor/types";

export function sourceLineOffsets(source: string, lines: Array<{ text: string; lastInParagraph: boolean }>) {
  let cursor = 0;
  return lines.map((line) => {
    const found = source.indexOf(line.text, cursor);
    const start = found < 0 ? cursor : found;
    cursor = start + line.text.length;
    if (line.lastInParagraph) {
      const newline = source.indexOf("\n", cursor);
      cursor = newline < 0 ? source.length : newline + 1;
    }
    return start;
  });
}

export function lineColorStops(text: string, sourceStart: number, ranges: TextColorRange[], baseColor: string,
  measure: (text: string) => number): Array<number | string> | null {
  const colored = ranges.filter((range) => range.start < sourceStart + text.length && range.end > sourceStart);
  const width = measure(text);
  if (!colored.length || width <= 0) return null;
  const stops: Array<number | string> = [0, baseColor];
  for (const range of colored) {
    const start = Math.max(0, range.start - sourceStart), end = Math.min(text.length, range.end - sourceStart);
    const x1 = Math.min(1, Math.max(0, measure(text.slice(0, start)) / width));
    const x2 = Math.min(1, Math.max(x1, measure(text.slice(0, end)) / width));
    stops.push(x1, baseColor, x1, range.color, x2, range.color, x2, baseColor);
  }
  stops.push(1, baseColor);
  return stops;
}
