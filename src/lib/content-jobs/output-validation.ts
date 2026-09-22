import {
  copySchema,
  hookSchema,
  referenceAnalysisSchema,
  strategySchema,
  validateStructuredOutput,
  type CopyOutput,
  type HookOutput,
  type ReferenceAnalysisOutput,
  type StrategyOutput,
  type StructuredOutputSchema,
} from "./schemas";

export type OutputValidation<Value> =
  | { ok: true; value: Value }
  | { ok: false; errors: string[] };

function unique(values: string[]) {
  return new Set(values).size === values.length;
}

function validate<Value>(
  schema: StructuredOutputSchema,
  value: unknown,
  semanticErrors: (value: Value) => string[],
): OutputValidation<Value> {
  const structural = validateStructuredOutput<Value>(schema, value);
  if (!structural.ok) return structural;
  const errors = semanticErrors(structural.value);
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: structural.value };
}

export function validateReferenceOutput(
  value: unknown,
  imageIds: string[],
): OutputValidation<ReferenceAnalysisOutput> {
  return validate(referenceAnalysisSchema, value, (output) => {
    const known = new Set(imageIds);
    const referenced = [
      ...output.visualLanguage.imageIds,
      ...output.slides.map((slide) => slide.imageId),
      ...output.writingStyle.imageIds,
      ...output.textDensity.imageIds,
      ...output.hook.imageIds,
    ];
    return referenced.every((id) => known.has(id))
      ? []
      : ["레퍼런스 분석이 존재하지 않는 이미지 ID를 참조합니다."];
  });
}

export function validateStrategyOutput(
  value: unknown,
  slideCount: number,
): OutputValidation<StrategyOutput> {
  return validate(strategySchema(slideCount), value, (output) => {
    const errors: string[] = [];
    const evidenceIds = output.evidence.map((item) => item.id);
    const strategyIds = output.strategies.map((item) => item.id);
    const angles = output.strategies.map((item) =>
      `${item.topic}:${item.angle}`.trim().toLocaleLowerCase(),
    );
    if (!unique(evidenceIds) || !unique(strategyIds) || !unique(angles))
      errors.push("근거와 전략의 ID 및 주제 각도는 서로 달라야 합니다.");
    const evidence = new Set(evidenceIds);
    if (
      output.strategies.some((strategy) =>
        strategy.slidePlan.some((slide) =>
          slide.evidenceIds.some((id) => !evidence.has(id)),
        ),
      )
    )
      errors.push("전략이 존재하지 않는 근거 ID를 참조합니다.");
    if (
      output.evidence.some((item) => {
        try {
          return !["http:", "https:"].includes(new URL(item.url).protocol);
        } catch {
          return true;
        }
      })
    )
      errors.push("근거 URL은 HTTP 또는 HTTPS 주소여야 합니다.");
    return errors;
  });
}

export function validateCopyOutput(
  value: unknown,
  slideCount: number,
  evidenceIds: string[],
): OutputValidation<CopyOutput> {
  return validate(copySchema(slideCount), value, (output) => {
    const slideIds = output.slides.map((slide) => slide.id);
    const allowedClaims = new Set(["product-context", ...evidenceIds]);
    const errors: string[] = [];
    if (!unique(slideIds)) errors.push("슬라이드 ID는 서로 달라야 합니다.");
    if (
      output.slides.some((slide) =>
        slide.claimReferences.some((id) => !allowedClaims.has(id)),
      )
    )
      errors.push("본문이 허용되지 않은 근거를 참조합니다.");
    return errors;
  });
}

export function validateHookOutput(
  value: unknown,
  slideIds: string[],
): OutputValidation<HookOutput> {
  return validate(hookSchema, value, (output) => {
    const knownSlides = new Set(slideIds);
    const hookIds = output.hooks.map((hook) => hook.id);
    const hookTexts = output.hooks.map((hook) =>
      hook.text.trim().toLocaleLowerCase(),
    );
    const errors: string[] = [];
    if (!unique(hookIds) || !unique(hookTexts))
      errors.push("훅 ID와 문구는 서로 달라야 합니다.");
    if (
      output.hooks.some(
        (hook) =>
          hook.supportingSlideIds.length === 0 ||
          hook.supportingSlideIds.some((id) => !knownSlides.has(id)),
      )
    )
      errors.push("훅은 존재하는 본문 슬라이드의 뒷받침을 받아야 합니다.");
    return errors;
  });
}
