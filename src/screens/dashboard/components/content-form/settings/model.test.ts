import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONTENT_SETTINGS, getSettingsSummary } from "./model";

test("콘텐츠 생성 설정은 영어를 기본 결과 언어로 사용한다", () => {
  assert.deepEqual(DEFAULT_CONTENT_SETTINGS, { ratio: "9:16", language: "English" });
  assert.equal(getSettingsSummary(DEFAULT_CONTENT_SETTINGS), "TikTok · 9:16 · English");
});
