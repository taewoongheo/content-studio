import { isDataField } from "@/lib/text/fields";
import type { Row } from "../../domain/contracts";

function mapProse(value: unknown, transform: (text: string) => string): unknown {
  if (typeof value === "string" && /[a-zA-Z]/.test(value) && !/^https?:\/\/\S+$/.test(value))
    return transform(value);
  if (Array.isArray(value)) return value.map(item => mapProse(item, transform));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([field, item]) =>
      [field, isDataField(field) ? item : mapProse(item, transform)]));
  return value;
}

export function collectProse(source: Row): string[] {
  const strings: string[] = [];
  mapProse(source, text => {
    strings.push(text);
    return text;
  });
  return strings;
}

export function applyTranslation(source: Row, strings: string[]): Row {
  let index = 0;
  return mapProse(source, () => strings[index++]) as Row;
}

const protectedTokens = (text: string): string[] =>
  [...(text.match(/https?:\/\/[^\s)\]]+|\d+(?:[.,]\d+)*/g) ?? [])].sort();

function retainsTokens(original: string, translated: string) {
  const remaining = protectedTokens(translated);
  return protectedTokens(original).every(token => {
    const index = remaining.indexOf(token);
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}

export function validateTranslation(originals: string[], translated: string[]) {
  if (translated.length !== originals.length)
    throw new Error("번역 결과의 항목 수·수치·URL이 원문과 다릅니다. 영어 원문을 확인해 주세요.");
  for (const [index, item] of translated.entries()) {
    // "Primary" may become "1차"; keep source tokens without forbidding new digits.
    if (typeof item !== "string" || !item.trim() || !retainsTokens(originals[index], item))
      throw new Error(`번역 ${index + 1}번째 항목의 수치·URL이 원문과 다릅니다. 영어 원문을 확인해 주세요.`);
  }
  if (!translated.some(value => /[가-힣]/.test(value)))
    throw new Error("한국어 번역을 받지 못했습니다.");
}
