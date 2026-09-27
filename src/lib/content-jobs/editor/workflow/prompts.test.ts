import assert from "node:assert/strict";
import test from "node:test";
import type { ContentJobInput } from "../../domain/types";
import { ContentJobRegistry } from "../../workflow/registry";
import { bodyPrompt, chatPrompt, hooksPrompt, topicsPrompt } from "./prompts";

const input: ContentJobInput = {
  model: "gpt-6-luna",
  structure: "repeating",
  productContext: { name: "제품", description: "설명", audience: "사용자", constraints: "" },
  aspectRatio: "9:16",
  slideCount: 4,
  outputLanguage: "English",
  referenceImages: [],
};

test("영어 결과 설정에서도 대화는 한국어, 생성 카피만 영어로 지정한다", () => {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add(input, "thread");
  const job = registry.getRecord("job");
  const topic = { id: "topic", title: "Topic", angle: "Angle", rationale: "이유", sourceUrls: [] };

  assert.match(topicsPrompt(job), /message와 각 주제의 rationale은 항상 한국어/);
  assert.match(topicsPrompt(job), /title과 angle은 콘텐츠 결과물이므로 English/);
  assert.match(bodyPrompt(job, topic), /message는 항상 한국어/);
  assert.match(bodyPrompt(job, topic), /실제 슬라이드 카피만 English/);
  assert.match(hooksPrompt(job), /rationale은 항상 한국어/);
  assert.match(hooksPrompt(job), /hooks의 text만 콘텐츠 결과물이므로 English/);
  assert.match(chatPrompt(job), /항상 한국어로 대화하세요/);
  assert.match(chatPrompt(job), /실제 슬라이드 카피만 English/);
});
