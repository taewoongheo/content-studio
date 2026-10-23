import { createHash } from "node:crypto";
import { readProductionSettings } from "../settings";
import { translateWithCodex } from "./cli-translator";
import { collectProse, applyTranslation, validateTranslation } from "./projection";
import type { Row } from "../../domain/contracts";

const MAX_CACHE_ENTRIES = 64;
const MAX_SOURCE_CHARACTERS = 100_000;
const TRANSLATION_TIMEOUT_MS = 120_000;
type Translator = (strings: string[], signal: AbortSignal, model: string) => Promise<string[]>;

/** A view projection only. This module has no store and never updates drafts. */
export function createDisplayTranslator(translate: Translator) {
  const cache = new Map<string, Promise<Row>>();

  async function project(source: Row, model: string) {
    const originals = collectProse(source);
    if (!originals.length) return structuredClone(source);
    if (JSON.stringify(originals).length > MAX_SOURCE_CHARACTERS)
      throw new Error("번역할 내용이 너무 많습니다. 영어 원문을 확인해 주세요.");
    const translated = await translate([...originals], AbortSignal.timeout(TRANSLATION_TIMEOUT_MS), model);
    validateTranslation(originals, translated);
    return applyTranslation(source, translated);
  }

  return (source: Row, model = ""): Promise<Row> => {
    const key = createHash("sha256").update(model + JSON.stringify(source)).digest("hex");
    const previous = cache.get(key);
    if (previous) return previous;
    const work = project(source, model);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(key, work);
    void work.catch(() => {
      if (cache.get(key) === work) cache.delete(key);
    });
    return work;
  };
}

const translate = createDisplayTranslator(translateWithCodex);
export function translateDisplay(source: Row) {
  return translate(source, readProductionSettings().model);
}
