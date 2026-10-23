import { createHash } from "node:crypto";
import { collectProse, applyTranslation, validateTranslation } from "../projection";
import type { Row } from "../../../domain/contracts";

type Translator = (strings: string[], signal: AbortSignal, model: string) => Promise<string[]>;
type Batch = { controller: AbortController; users: number; settled: boolean; work: Promise<string[]>; keys: string[] };
type Pending = { batch: Batch; index: number };
const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
function segments(text: string) {
  return [...segmenter.segment(text)].map(({ segment }) => segment.trim() ? {
    text: segment.trim(), before: segment.match(/^\s*/)?.[0] ?? "", after: segment.match(/\s*$/)?.[0] ?? "",
  } : { text: "", before: segment, after: "" });
}
const keyFor = (model: string, text: string) => createHash("sha256").update(JSON.stringify(["sentence-v1", model, text])).digest("hex");

/** Cache only display sentences. Never writes production data or uses Korean as model input. */
export function createDisplayTranslator(translate: Translator, options: {
  cache?: Map<string, string>; onCacheChange?: (cache: Map<string, string>) => void;
} = {}) {
  const cache = options.cache ?? new Map<string, string>();
  const pending = new Map<string, Pending>();
  function touch(key: string, value: string) {
    cache.delete(key); cache.set(key, value);
  }
  function remember(keys: string[], values: string[]) {
    keys.forEach((key, index) => touch(key, values[index]));
    let characters = [...cache.values()].reduce((total, value) => total + value.length, 0);
    while (cache.size > 1024 || characters > 1_000_000) {
      const oldest = cache.keys().next().value!;
      characters -= cache.get(oldest)!.length; cache.delete(oldest);
    }
    options.onCacheChange?.(cache);
  }
  function start(texts: string[], model: string) {
    const controller = new AbortController();
    const keys = texts.map(text => keyFor(model, text));
    const batch: Batch = { controller, users: 0, settled: false, keys, work: Promise.resolve([]) };
    batch.work = Promise.resolve().then(async () => {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]);
      signal.throwIfAborted();
      const translated = await translate(texts, signal, model);
      signal.throwIfAborted();
      validateTranslation(texts, translated);
      remember(keys, translated);
      return translated;
    }).finally(() => {
      batch.settled = true;
      for (const key of keys) if (pending.get(key)?.batch === batch) pending.delete(key);
    });
    void batch.work.catch(() => undefined);
    keys.forEach((key, index) => pending.set(key, { batch, index }));
  }
  return async (source: Row, model = "", signal?: AbortSignal): Promise<Row> => {
    signal?.throwIfAborted();
    const originals = collectProse(source);
    if (!originals.length) return structuredClone(source);
    if (JSON.stringify(originals).length > 100_000)
      throw new Error("번역할 내용이 너무 많습니다. 영어 원문을 확인해 주세요.");
    const pieces = originals.map(segments);
    const texts = [...new Set(pieces.flatMap(parts => parts.map(part => part.text)).filter(Boolean))];
    const missing = texts.filter(text => !cache.has(keyFor(model, text)) && !pending.has(keyFor(model, text)));
    if (missing.length) start(missing, model);
    // Capture resolved values now; another request can evict them while this request waits.
    const values = new Map<string, string>();
    const waiting: Array<[string, Pending]> = [];
    for (const text of texts) {
      const key = keyFor(model, text), value = cache.get(key);
      if (value !== undefined) { values.set(text, value); touch(key, value); }
      else waiting.push([text, pending.get(key)!]);
    }
    const batches = new Set(waiting.map(([, entry]) => entry.batch));
    batches.forEach(batch => batch.users++);
    let release!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      release = () => reject(signal?.reason ?? new DOMException("Translation cancelled", "AbortError"));
      signal?.addEventListener("abort", release, { once: true });
    });
    try {
      if (signal?.aborted) release();
      await Promise.race([
        Promise.all(waiting.map(async ([text, entry]) => values.set(text, (await entry.batch.work)[entry.index]))),
        aborted,
      ]);
      const translated = pieces.map(parts => parts.map(part => part.before + (values.get(part.text) ?? part.text) + part.after).join(""));
      validateTranslation(originals, translated);
      return applyTranslation(source, translated);
    } finally {
      signal?.removeEventListener("abort", release);
      for (const batch of batches) {
        batch.users--;
        if (!batch.users && !batch.settled) {
          batch.controller.abort(new DOMException("Translation no longer displayed", "AbortError"));
          for (const key of batch.keys) if (pending.get(key)?.batch === batch) pending.delete(key);
        }
      }
    }
  };
}
