import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readProductionSettings, saveProductionSettings } from "./settings";
test("제작 모델은 5.6 sol로 시작하고 전역 CLI 설정 없이 별도 보존한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "production-settings-"));
  const before = process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
  process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = directory;
  try {
    assert.equal(readProductionSettings().model, "gpt-5.6-sol");
    saveProductionSettings({ model: "gpt-5.6-sol" });
    assert.equal(readProductionSettings().model, "gpt-5.6-sol");
    assert.throws(() => saveProductionSettings({ model: "x; command" }));
  } finally {
    if (before === undefined)
      delete process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR;
    else process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = before;
    rmSync(directory, { recursive: true, force: true });
  }
});
