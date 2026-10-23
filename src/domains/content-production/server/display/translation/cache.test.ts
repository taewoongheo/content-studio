import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDisplayTranslator } from "./translator";
import { loadTranslationCache, saveTranslationCache } from "./cache";

test("validated display sentences survive translator recreation without touching production data", async () => {
  const directory = mkdtempSync(join(tmpdir(), "translation-cache-"));
  const previous = process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
  process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = directory;
  try {
    const first = createDisplayTranslator(async () => ["3세트를 수행한다"], { cache: loadTranslationCache(), onCacheChange: saveTranslationCache });
    await first({ answer: "Use 3 sets" }, "model");
    let calls = 0;
    const second = createDisplayTranslator(async () => { calls++; return []; }, { cache: loadTranslationCache() });
    assert.deepEqual(await second({ answer: "Use 3 sets" }, "model"), { answer: "3세트를 수행한다" });
    assert.equal(calls, 0);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
    else process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
