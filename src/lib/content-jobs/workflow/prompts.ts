import type { ContentJobRecord } from "../domain/types";
import type { StrategyOutput } from "../structured-output/schemas";

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const sharedRules = `반드시 제공된 JSON Schema에 맞는 JSON만 최종 응답으로 반환하세요.
확인할 수 없는 내용은 추측하지 말고 uncertainties 또는 missingInformation에 기록하세요.`;

function slideStructureRule(job: ContentJobRecord) {
  return job.structure === "repeating"
    ? `총 ${job.slideCount}장 중 첫 장의 role은 "hook", 마지막 장의 role은 "cta", 가운데 ${job.slideCount - 2}장의 role은 모두 "body"로 정확히 작성하세요. 가운데 장은 같은 시각 포맷과 문체를 반복하되 내용은 장마다 다르게 전개하세요.`
    : "입력된 레퍼런스의 장면별 전개와 전환을 활용하세요.";
}

export function referenceAnalysisPrompt(job: ContentJobRecord) {
  const referenceInstructions =
    job.structure === "repeating"
      ? `이 세 이미지는 전체 게시물이 아니라 훅, 반복 본문, CTA의 대표 예시입니다.
이미지 역할: ${job.referenceImages.map((image) => `${image.id}=${image.role}`).join(", ")}
slides에는 이 세 이미지를 입력 순서대로 한 번씩만 넣고 role은 정확히 "hook", "body", "cta"로 작성하세요.
repetitionPattern에는 중간 본문 장에서 반복할 레이아웃, 내용 전개, 텍스트 밀도와 전환 규칙을 구체적으로 적으세요. 관찰할 수 없는 변형은 추측하지 마세요.`
      : `모든 이미지는 게시물의 실제 슬라이드 순서입니다. slides에는 각 이미지를 입력 순서대로 한 번씩 넣으세요. repetitionPattern은 빈 문자열로 작성하세요.`;
  return `${sharedRules}

다음 TikTok 슬라이드쇼 레퍼런스 이미지를 순서대로 분석하세요.
이미지 ID 순서: ${job.referenceImages.map((image) => image.id).join(", ")}
결과 언어: ${job.outputLanguage}
출력 화면 비율: ${job.aspectRatio}
${referenceInstructions}

구조, 시각 언어, 슬라이드별 서사 역할, 장면 전환, 문체, 텍스트 밀도, 원문 훅과 재사용 가능한 훅 패턴을 구분하세요.
모든 관찰은 근거가 된 이미지 ID를 사용하세요.`;
}

export function strategyPrompt(job: ContentJobRecord) {
  return `${sharedRules}

승인된 레퍼런스 분석과 제품 정보를 바탕으로 현재 시점에 유효한 콘텐츠 주제와 적용 전략을 정확히 3개 제안하세요.
필요한 사실은 인터넷에서 조사하고 실제 출처 URL과 안정적인 근거 ID를 포함하세요.
세 전략은 주제 또는 콘텐츠 각도가 실질적으로 달라야 합니다.
각 전략의 슬라이드 계획은 정확히 ${job.slideCount}개여야 합니다.
각 전략의 시각 구성은 ${job.aspectRatio} 세로형 화면에 맞아야 합니다.
${slideStructureRule(job)}

제품 정보:
${json(job.productContext)}

승인된 레퍼런스 분석:
${json(job.state.reference.accepted)}`;
}

export function copyPrompt(job: ContentJobRecord) {
  const accepted = job.state.strategy.accepted as
    | (StrategyOutput & { selectedStrategyId: string })
    | null;
  const selectedStrategy = accepted?.strategies.find(
    (strategy) => strategy.id === accepted.selectedStrategyId,
  );
  return `${sharedRules}

승인된 전략으로 TikTok 슬라이드쇼 본문 카피를 작성하세요.
슬라이드는 정확히 ${job.slideCount}개이고 결과 언어는 ${job.outputLanguage}입니다.
각 슬라이드의 시각 방향은 ${job.aspectRatio} 화면에 맞게 작성하세요.
${slideStructureRule(job)}
이 단계에서는 최종 훅을 만들지 마세요.
사실 주장은 product-context 또는 제공된 evidence ID만 참조하세요.

제품 정보:
${json(job.productContext)}

승인된 레퍼런스 분석:
${json(job.state.reference.accepted)}

승인된 전략:
${json({ strategy: selectedStrategy, evidence: accepted?.evidence ?? [] })}`;
}

export function hookPrompt(job: ContentJobRecord) {
  return `${sharedRules}

승인된 본문을 바탕으로 서로 다른 훅 후보를 정확히 4개 작성하세요.
승인된 레퍼런스의 훅 패턴을 적용하되 원문을 그대로 복사하지 마세요.
각 훅은 약속을 실제로 뒷받침하는 본문 슬라이드 ID를 하나 이상 참조해야 합니다.

승인된 레퍼런스 분석:
${json(job.state.reference.accepted)}

승인된 본문:
${json(job.state.copy.accepted)}`;
}
