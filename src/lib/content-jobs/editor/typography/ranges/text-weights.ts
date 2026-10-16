import type { TextColorRange, TextWeightRange } from "../../types";
import { remapTextRanges, setTextRange, validTextRanges } from "./text-ranges";

const sameWeight = (a: TextWeightRange, b: TextWeightRange) => a.fontWeight === b.fontWeight;
export function validTextWeights(text: string, ranges: TextWeightRange[]) {
  return validTextRanges(text, ranges, (range) => Number.isInteger(range.fontWeight) && range.fontWeight >= 100 && range.fontWeight <= 900);
}
export function setTextWeight(text: string, ranges: TextWeightRange[], start: number, end: number, fontWeight: number | null) {
  return setTextRange(text, ranges, start, end, fontWeight === null ? null : { fontWeight }, sameWeight);
}
export function remapTextWeights(before: string, after: string, ranges: TextWeightRange[]) {
  return remapTextRanges(before, after, ranges, sameWeight);
}

/** Color and weight ranges are independent; split at their combined boundaries. */
export function styledTextParts(text: string, colors: TextColorRange[], weights: TextWeightRange[]) {
  const boundaries = [...new Set([0, text.length, ...colors.flatMap(r => [r.start, r.end]), ...weights.flatMap(r => [r.start, r.end])])].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => ({
    text: text.slice(start, boundaries[i + 1]),
    color: colors.find(r => r.start <= start && r.end > start)?.color,
    fontWeight: weights.find(r => r.start <= start && r.end > start)?.fontWeight,
  }));
}
