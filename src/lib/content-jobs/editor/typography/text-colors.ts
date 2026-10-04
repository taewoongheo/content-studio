import type { TextColorRange } from "../types";

export const MAX_TEXT_COLOR_RANGES = 200;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function textBoundaries(text: string) {
  return new Set([...segmenter.segment(text)].map((part) => part.index).concat(text.length));
}

export function validTextColors(text: string, ranges: TextColorRange[]) {
  if (!Array.isArray(ranges) || ranges.length > MAX_TEXT_COLOR_RANGES) return false;
  const boundaries = textBoundaries(text);
  let end = 0;
  return ranges.every((range) => {
    if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < end ||
      range.end <= range.start || !boundaries.has(range.start) || !boundaries.has(range.end) ||
      !/^#[0-9a-fA-F]{6}$/.test(range.color)) return false;
    end = range.end;
    return true;
  });
}

function merge(ranges: TextColorRange[]) {
  const result: TextColorRange[] = [];
  for (const range of ranges.filter((range) => range.start < range.end).sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && last.end === range.start && last.color.toLowerCase() === range.color.toLowerCase()) last.end = range.end;
    else result.push({ ...range });
  }
  return result;
}

export function selectedTextRange(text: string, start: number, end: number) {
  if (start === end) return { start, end };
  const boundaries = [...textBoundaries(text)];
  return {
    start: boundaries.filter((index) => index <= start).at(-1) ?? 0,
    end: boundaries.find((index) => index >= end) ?? text.length,
  };
}

export function setTextColor(text: string, ranges: TextColorRange[], start: number, end: number, color: string | null) {
  const selection = selectedTextRange(text, start, end);
  if (selection.start >= selection.end) return ranges;
  const next = ranges.flatMap((range) => range.end <= selection.start || range.start >= selection.end ? [{ ...range }] : [
    { ...range, end: Math.min(range.end, selection.start) },
    { ...range, start: Math.max(range.start, selection.end) },
  ]);
  if (color) next.push({ ...selection, color });
  return merge(next);
}

/** Find the changed span without splitting a grapheme in either text. */
function changedTextSpan(before: string, after: string) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  const beforeBounds = textBoundaries(before), afterBounds = textBoundaries(after);
  while (start > 0 && (!beforeBounds.has(start) || !afterBounds.has(start))) start--;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  while (oldEnd < before.length && (!beforeBounds.has(oldEnd) || !afterBounds.has(newEnd))) { oldEnd++; newEnd++; }
  return { start, oldEnd, newEnd, afterBounds };
}

/** UTF-16 offsets, exclusive end. Keep unaffected text; inserted text inherits an enclosing color. */
export function remapTextColors(before: string, after: string, ranges: TextColorRange[]) {
  if (before === after) return ranges.map((range) => ({ ...range }));
  const { start, oldEnd, newEnd, afterBounds } = changedTextSpan(before, after);
  const delta = newEnd - oldEnd;
  const next = ranges.flatMap((range) => [
    { ...range, end: Math.min(range.end, start) },
    { ...range, start: Math.max(range.start, oldEnd) + delta, end: range.end + delta },
  ]);
  const isReplacement = oldEnd > start;
  const enclosing = ranges.find((range) => {
    const containsChangedSpan = range.start <= start && range.end >= oldEnd;
    const insertionInsideColor = start > range.start && start < range.end;
    return containsChangedSpan && (isReplacement || insertionInsideColor);
  });
  if (enclosing && newEnd > start) next.push({ start, end: newEnd, color: enclosing.color });
  return merge(next).filter((range) => afterBounds.has(range.start) && afterBounds.has(range.end));
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
