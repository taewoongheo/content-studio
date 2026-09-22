import assert from "node:assert/strict";
import test from "node:test";
import {
  copySchema,
  hookSchema,
  referenceAnalysisSchema,
  strategySchema,
  validateStructuredOutput,
} from "./schemas";

const referenceAnalysis = {
  sourceLanguage: "en",
  outputLanguage: "ko",
  visualLanguage: { summary: "굵은 제목", imageIds: ["image-1"] },
  slides: [
    {
      imageId: "image-1",
      role: "문제 제기",
      transitionFromPrevious: "첫 슬라이드",
    },
  ],
  writingStyle: { summary: "짧고 직접적", imageIds: ["image-1"] },
  textDensity: { summary: "한 장당 두 문장", imageIds: ["image-1"] },
  hook: {
    originalText: "Stop doing this",
    pattern: "금지형",
    imageIds: ["image-1"],
  },
  uncertainties: [],
};

test("레퍼런스 분석은 필수 필드와 추가 필드를 엄격하게 검사한다", () => {
  assert.equal(
    validateStructuredOutput(referenceAnalysisSchema, referenceAnalysis).ok,
    true,
  );
  assert.equal(
    validateStructuredOutput(referenceAnalysisSchema, {
      ...referenceAnalysis,
      unknown: true,
    }).ok,
    false,
  );
  const missingField = Object.fromEntries(
    Object.entries(referenceAnalysis).filter(([key]) => key !== "writingStyle"),
  );
  assert.equal(
    validateStructuredOutput(referenceAnalysisSchema, missingField).ok,
    false,
  );
});

test("전략은 정확히 3개이고 슬라이드 계획은 설정한 수와 같아야 한다", () => {
  const strategy = {
    evidence: [
      {
        id: "evidence-1",
        url: "https://example.com/source",
        title: "출처",
        summary: "근거 요약",
      },
    ],
    strategies: Array.from({ length: 3 }, (_, strategyIndex) => ({
      id: `strategy-${strategyIndex + 1}`,
      topic: "주제",
      angle: `각도 ${strategyIndex + 1}`,
      referenceFit: "레퍼런스 패턴과 맞음",
      slidePlan: Array.from({ length: 5 }, (_, slideIndex) => ({
        id: `slide-${slideIndex + 1}`,
        role: "전개",
        productFact: "제품 사실",
        evidenceIds: ["evidence-1"],
      })),
      warnings: [],
    })),
    missingInformation: [],
  };

  assert.equal(validateStructuredOutput(strategySchema(5), strategy).ok, true);
  assert.equal(
    validateStructuredOutput(strategySchema(5), {
      ...strategy,
      strategies: strategy.strategies.slice(0, 2),
    }).ok,
    false,
  );
  assert.equal(
    validateStructuredOutput(strategySchema(4), strategy).ok,
    false,
  );
});

test("본문과 훅은 설정된 고정 개수를 검사한다", () => {
  const copy = {
    slides: Array.from({ length: 3 }, (_, index) => ({
      id: `slide-${index + 1}`,
      role: "전개",
      headline: "헤드라인",
      body: "본문",
      visualDirection: "시각 방향",
      transitionFromPrevious: "연결",
      claimReferences: ["product-context"],
    })),
    uncertainties: [],
  };
  const hooks = {
    hooks: Array.from({ length: 4 }, (_, index) => ({
      id: `hook-${index + 1}`,
      text: `훅 ${index + 1}`,
      pattern: "대조형",
      angle: "강조 각도",
      supportingSlideIds: ["slide-2"],
    })),
    warnings: [],
  };

  assert.equal(validateStructuredOutput(copySchema(3), copy).ok, true);
  assert.equal(validateStructuredOutput(copySchema(4), copy).ok, false);
  assert.equal(validateStructuredOutput(hookSchema, hooks).ok, true);
  assert.equal(
    validateStructuredOutput(hookSchema, {
      ...hooks,
      hooks: hooks.hooks.slice(0, 3),
    }).ok,
    false,
  );
});
