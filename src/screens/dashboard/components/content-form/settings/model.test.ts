import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_SIZE_PRESETS, DEFAULT_CONTENT_SETTINGS, getSettingsSummary } from "./model";

test("콘텐츠 생성 설정은 4:5 1080×1350과 영어를 기본값으로 사용한다", () => {
  assert.deepEqual(DEFAULT_CONTENT_SETTINGS, { ratio: "4:5", language: "English" });
  assert.equal(getSettingsSummary(DEFAULT_CONTENT_SETTINGS), "TikTok · 4:5 · 1080×1350 · English");
  assert.deepEqual(CONTENT_SIZE_PRESETS.map((preset) => preset.label),
    ["4:5 · 1080×1350", "9:16 · 1080×1920"]);
});
