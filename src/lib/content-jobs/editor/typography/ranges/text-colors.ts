import type { TextColorRange } from "../../types";
import { MAX_TEXT_RANGES, remapTextRanges, setTextRange, validTextRanges } from "./text-ranges";
export { selectedTextRange, textBoundaries } from "./text-ranges";

export const MAX_TEXT_COLOR_RANGES = MAX_TEXT_RANGES;
const sameColor = (a: TextColorRange, b: TextColorRange) => a.color.toLowerCase() === b.color.toLowerCase();
export function validTextColors(text: string, ranges: TextColorRange[]) {
  return validTextRanges(text, ranges, (range) => typeof range.color === "string" && /^#[0-9a-fA-F]{6}$/.test(range.color));
}
export function setTextColor(text: string, ranges: TextColorRange[], start: number, end: number, color: string | null) {
  return setTextRange(text, ranges, start, end, color ? { color } : null, sameColor);
}
export function remapTextColors(before: string, after: string, ranges: TextColorRange[]) {
  return remapTextRanges(before, after, ranges, sameColor);
}

export function textColorParts(text: string, ranges: TextColorRange[]) {
  const parts: Array<{ text: string; color?: string }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (cursor < range.start) parts.push({ text: text.slice(cursor, range.start) });
    parts.push({ text: text.slice(range.start, range.end), color: range.color });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
