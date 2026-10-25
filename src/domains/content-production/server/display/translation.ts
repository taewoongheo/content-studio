import { translateWithCodex } from "./translation/cli-translator";
import { createDisplayTranslator } from "./translation/translator";
import { loadTranslationCache, saveTranslationCache } from "./translation/cache";
import type { Row } from "../../domain/contracts";
export { createDisplayTranslator } from "./translation/translator";

// Retain in-flight sentence sharing across Next dev module reloads.
const shared = globalThis as typeof globalThis & { productionDisplayTranslatorV3?: ReturnType<typeof createDisplayTranslator> };
const translate = (shared.productionDisplayTranslatorV3 ??= createDisplayTranslator(translateWithCodex, {
  cache: loadTranslationCache(), onCacheChange: saveTranslationCache,
}));
export const DISPLAY_TRANSLATION_MODEL = "gpt-6-luna";
export function translateDisplay(source: Row, signal?: AbortSignal) {
  return translate(source, DISPLAY_TRANSLATION_MODEL, signal);
}
