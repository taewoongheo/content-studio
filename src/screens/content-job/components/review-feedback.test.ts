import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewCompletion, ReviewNotes } from "./review-feedback";

test("uncertainties render as a separate read-only section", () => {
  const html = renderToStaticMarkup(createElement(ReviewNotes, { items: ["출처 확인 필요"] }));
  assert.match(html, /확인 필요/);
  assert.match(html, /출처 확인 필요/);
  assert.doesNotMatch(html, /textarea|input/);
});

test("stage-wide regeneration and approval share the final action area", () => {
  const html = renderToStaticMarkup(createElement(ReviewCompletion, {
    scope: "레퍼런스 분석 전체",
    approveLabel: "승인하고 전략 만들기",
    disabled: false,
    approveDisabled: false,
    onRegenerate: async () => {},
    onApprove: async () => {},
  }));
  assert.match(html, /레퍼런스 분석 전체/);
  assert.match(html, /재생성하면 레퍼런스 분석 전체를 새로 제안받습니다/);
  assert.match(html, />재생성<\/button>/);
  assert.match(html, /승인하고 전략 만들기/);
  assert.ok(html.indexOf(">재생성</button>") < html.indexOf("승인하고 전략 만들기"));
  assert.doesNotMatch(html, /justify-between gap-3 border-t/);
  assert.match(html, /disabled=""/);
});
