import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegenerateControl, ReviewNotes } from "./review-feedback";

test("uncertainties render as a separate read-only section", () => {
  const html = renderToStaticMarkup(createElement(ReviewNotes, { items: ["출처 확인 필요"] }));
  assert.match(html, /확인 필요/);
  assert.match(html, /출처 확인 필요/);
  assert.doesNotMatch(html, /textarea|input/);
});

test("regeneration needs an explicit user request", () => {
  const html = renderToStaticMarkup(createElement(RegenerateControl, {
    disabled: false,
    onRegenerate: async () => {},
  }));
  assert.match(html, /수정 요청/);
  assert.match(html, /재생성/);
  assert.match(html, /disabled=""/);
});
