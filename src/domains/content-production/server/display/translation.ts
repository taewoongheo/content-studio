import { readProductionSettings } from "../settings";
import { translateWithCodex } from "./translation/cli-translator";
import { createDisplayTranslator } from "./translation/translator";
import { loadTranslationCache, saveTranslationCache } from "./translation/cache";
import type { Row } from "../../domain/contracts";
export { createDisplayTranslator } from "./translation/translator";

// Retain in-flight sentence sharing across Next dev module reloads.
const shared = globalThis as typeof globalThis & { productionDisplayTranslatorV2?: ReturnType<typeof createDisplayTranslator> };
const translate = (shared.productionDisplayTranslatorV2 ??= createDisplayTranslator(translateWithCodex, {
  cache: loadTranslationCache(), onCacheChange: saveTranslationCache,
}));
export function translateDisplay(source: Row, signal?: AbortSignal) {
  return translate(source, readProductionSettings().model, signal);
}
