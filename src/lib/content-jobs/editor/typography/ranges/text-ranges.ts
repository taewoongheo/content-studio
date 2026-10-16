const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
export function textBoundaries(text: string) {
  return new Set([...segmenter.segment(text)].map((part) => part.index).concat(text.length));
}

export type TextRange = { start: number; end: number };
export const MAX_TEXT_RANGES = 200;

export function validTextRanges<T extends TextRange>(text: string, ranges: T[], validValue: (range: T) => boolean) {
  if (!Array.isArray(ranges) || ranges.length > MAX_TEXT_RANGES) return false;
  const boundaries = textBoundaries(text);
  let end = 0;
  return ranges.every((range) => {
    if (!range || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < end ||
      range.end <= range.start || !boundaries.has(range.start) || !boundaries.has(range.end) || !validValue(range)) return false;
    end = range.end;
    return true;
  });
}

function merge<T extends TextRange>(ranges: T[], sameValue: (a: T, b: T) => boolean) {
  const result: T[] = [];
  for (const range of ranges.filter((range) => range.start < range.end).sort((a, b) => a.start - b.start)) {
    const last = result.at(-1);
    if (last && last.end === range.start && sameValue(last, range)) last.end = range.end;
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

export function setTextRange<T extends TextRange>(text: string, ranges: T[], start: number, end: number, value: Omit<T, "start" | "end"> | null, sameValue: (a: T, b: T) => boolean) {
  const selection = selectedTextRange(text, start, end);
  if (selection.start >= selection.end) return ranges;
  const next = ranges.flatMap((range) => range.end <= selection.start || range.start >= selection.end ? [{ ...range }] : [
    { ...range, end: Math.min(range.end, selection.start) },
    { ...range, start: Math.max(range.start, selection.end) },
  ]);
  if (value) next.push({ ...selection, ...value } as T);
  return merge(next, sameValue);
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

/** UTF-16 offsets, exclusive end. Keep unaffected text; inserted text inherits an enclosing style. */
export function remapTextRanges<T extends TextRange>(before: string, after: string, ranges: T[], sameValue: (a: T, b: T) => boolean) {
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
    const insertionInsideRange = start > range.start && start < range.end;
    return containsChangedSpan && (isReplacement || insertionInsideRange);
  });
  if (enclosing && newEnd > start) next.push({ ...enclosing, start, end: newEnd });
  return merge(next, sameValue).filter((range) => afterBounds.has(range.start) && afterBounds.has(range.end));
}

