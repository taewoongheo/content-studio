import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCopyOutput,
  validateReferenceOutput,
  validateStrategyOutput,
} from "./output-validation";

const imageIds = ["image-1", "image-2", "image-3"];
const reference = {
  sourceLanguage: "en",
  outputLanguage: "ko",
  visualLanguage: { summary: "같은 본문 레이아웃", imageIds },
  slides: imageIds.map((imageId, index) => ({
    imageId,
    role: ["hook", "body", "cta"][index],
    transitionFromPrevious: "일정한 전환",
  })),
  writingStyle: { summary: "짧은 문장", imageIds },
  textDensity: { summary: "한 문장", imageIds },
  repetitionPattern: "중간 장의 배치와 텍스트 밀도를 반복한다",
  hook: { originalText: "Start here", pattern: "명령형", imageIds: ["image-1"] },
  uncertainties: [],
};

const roles = ["hook", "body", "body", "cta"];
const strategy = {
  evidence: [],
  strategies: Array.from({ length: 3 }, (_, index) => ({
    id: `strategy-${index + 1}`,
    topic: `주제 ${index + 1}`,
    angle: `각도 ${index + 1}`,
    referenceFit: "반복 본문 포맷 적용",
    slidePlan: roles.map((role, slideIndex) => ({
      id: `strategy-${index + 1}-slide-${slideIndex + 1}`,
      role,
      productFact: "제품 설명",
      evidenceIds: [],
    })),
    warnings: [],
  })),
  missingInformation: [],
};

const copy = {
  slides: roles.map((role, index) => ({
    id: `slide-${index + 1}`,
    role,
    headline: `제목 ${index + 1}`,
    body: "본문",
    visualDirection: "같은 레이아웃",
    transitionFromPrevious: "반복",
    claimReferences: ["product-context"],
  })),
  uncertainties: [],
};

test("repeating references require hook, body, CTA representatives in order", () => {
  assert.equal(validateReferenceOutput(reference, imageIds, "repeating").ok, true);
  assert.equal(
    validateReferenceOutput({ ...reference, repetitionPattern: "" }, imageIds, "repeating").ok,
    false,
  );
  assert.equal(
    validateReferenceOutput(
      { ...reference, slides: reference.slides.map((slide, index) => index === 1 ? { ...slide, role: "other" } : slide) },
      imageIds,
      "repeating",
    ).ok,
    false,
  );
});

test("repeating strategy and copy keep hook, body, CTA positions", () => {
  assert.equal(validateStrategyOutput(strategy, 4, "repeating").ok, true);
  assert.equal(validateCopyOutput(copy, 4, [], "repeating").ok, true);
  assert.equal(
    validateStrategyOutput({
      ...strategy,
      strategies: strategy.strategies.map((item, index) =>
        index === 0 ? { ...item, slidePlan: item.slidePlan.map((slide, slideIndex) =>
          slideIndex === 3 ? { ...slide, role: "body" } : slide) } : item),
    }, 4, "repeating").ok,
    false,
  );
  assert.equal(
    validateCopyOutput({
      ...copy,
      slides: copy.slides.map((slide, index) =>
        index === 1 ? { ...slide, role: "cta" } : slide),
    }, 4, [], "repeating").ok,
    false,
  );
});
