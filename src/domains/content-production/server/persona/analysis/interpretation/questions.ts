import { z } from "zod";
import { personaSections, type PersonaContent } from "../../../../domain/persona/model";

const questions: Record<string, Record<string, string>> = {
  profile: { concept: "어떤 정체성과 관점으로 무엇을 약속하는 화자인가? 계정 소개를 간결하게 종합한다." },
  audience: {
    demographics: "콘텐츠의 어휘와 난이도로 추론 가능한 대상과 숙련도. 실제 인구통계로 단정하지 않는다.",
    motivation: "독자가 이 화자를 계속 팔로우할 구체적인 이유는 무엇인가?",
    needs: "독자가 반복해서 해결하려는 질문과 어려움은 무엇인가?",
    promise: "콘텐츠를 읽으면 무엇을 얻는다는 암묵적 약속을 하는가?",
  },
  hook: {
    patterns: "표지 훅을 설득 장치별로 분류하고 유형별 문장 공식과 실제 예문을 제시한다. 캡션 첫 문장은 별도로 구분한다. 각 유형이 나타난 게시물 수/전체 게시물 수를 집계한다. 중복 분류면 명시한다.",
    tone: "훅의 말투, 확신, 독자 호명 방식. 그 톤을 보여주는 실제 표현을 제시한다.",
    techniques: "숫자, 손실 회피, 호기심, 통념 반박 등의 장치가 어떤 단어와 문장 구성으로 작동하는가?",
    length: "제공된 표지 텍스트 길이 통계를 사용한다.",
  },
  titles: { patterns: "제목의 구문 공식(예: 숫자+대상+효익), 단어 선택, 대소문자, 표지와 내부 소제목의 차이. 실제 예문과 재사용 가능한 공식을 설명한다." },
  sentences: {
    post_length: "제공된 게시물별 전체 슬라이드 문구와 캡션의 평균 단어·글자 수를 각각 사용한다. 슬라이드 장수로 대체하지 않는다.",
    sentence_length: "제공된 문장 길이 통계와 측정 기준을 사용한다.",
    paragraphs: "문단당 문장 수, 단문/단편/목록의 조합, 한 문단에 담는 정보 단위. 슬라이드와 캡션을 구분한다.",
    line_breaks: "문구의 실제 줄바꿈과 빈 줄 위치, 의미 단위를 끊는 방식. 이미지의 단순 자동 줄바꿈과 의도적인 구획을 구분한다.",
    conjunctions: "접속사와 연결 구문의 종류, 생략 방식, 논리 관계와 리듬에 미치는 효과. 실제 짧은 예문을 제시한다.",
  },
  development: {
    structure: "페이지 목록이 아니라 논리·설득의 순서를 분석한다. 예: 문제 제기 → 통념 교정 → 대안 → 실행 기준. 반복되는 전개 유형마다 시작/중간/마무리의 역할과 연결 방식을 설명한다.",
    contrast: "통념 대 사실, 기존 행동 대 대안, 예상 대 결과 등 논리적 대비·반전의 대상과 전환 문구를 분석한다. OR로 대체 운동을 나열하는 것은 선택지 제공이며 자동으로 반전이라고 분류하지 않는다. 관찰되지 않으면 없다고 쓴다.",
    conclusion: "마지막 내용이 무엇인지가 아니라 어떻게 종결하는지 분석한다. 단언/요약/실행 기준/질문/여운 등 본문 결말의 문장 형태와 효과. 별도 홍보 CTA와 본문 결말을 구분한다.",
  },
  endings: {
    patterns: "게시물 끝이 아니라 각 문장의 종결 방식이다. 평서형·명령/권유형·의문형·단편형의 특징, 반복되는 동사/구문과 실제 예문. 언어에 맞는 종결·문장 유형을 분석한다.",
    formality: "문장의 격식/비격식 표현과 구어체, 축약, 존대 또는 직접 호명 방식을 분석한다. 비율을 제시하려면 실제 문장 단위로 집계하고 분모를 쓴다.",
    rules: "설명·지시·반박·호기심 유도 등 상황별로 어떤 종결형을 선택하는가? 실제 표현과 함께 재사용 규칙을 제시한다. 마지막 슬라이드 내용이나 인사 유무로 대체하지 않는다.",
  },
  relationship: {
    relationship: "독자와의 관계를 동료/선배/코치 등의 관점으로 설명하고 호칭, 대명사, 지시 방식에서 근거를 찾는다.",
    confidence: "단정, 완곡, 한정, 개인 의견 표시를 어떻게 사용하는가? 주장 자체의 사실 검증과 말투 분석을 혼동하지 않는다.",
    disclosure: "1인칭 경험·실수·감정을 얼마나, 어떤 목적으로 노출하는가? 실제 표현을 제시한다.",
  },
  personality: {
    frequency: "유머가 나타난 게시물 수/전체 게시물 수를 집계한다. 농담, 말장난, 반어 같은 텍스트 유머만 해당한다. 게시 빈도나 캐릭터 등장 빈도가 아니다.",
    humor: "농담·말장난·반어 등 관찰된 유머 유형과 실제 표현, 사용 상황. 관찰되지 않으면 간결하게 없다고 쓴다.",
    traits: "반복 어휘, 특유의 말버릇, 관점과 표현상의 개성. 캐릭터 외형 설명으로 대체하지 않는다.",
  },
  cta: { types: "CTA를 시청 지속/참여/실행/팔로우/홍보 등 실제 목적별로 나누어 각 유형의 목적, 배치, 문장 공식, 실제 예문을 작성한다. 단순 제품 소개와 명시적 행동 요청은 구분한다." },
  links: { rules: "링크를 직접 쓰는지 프로필 링크로 안내하는지 등 관찰된 표현 방식만 분석한다. URL이나 출처 표기는 출력하지 않는다. 제작에 링크를 넣으라는 지시를 만들지 않는다." },

};

const fieldSchema = (question: string) => z.object({
  observation: z.string().min(1).max(6000).describe(question + " 원문 인용은 examples에만 넣고 여기서는 해석을 설명한다."),
  examples: z.array(z.string().min(1).max(1000)).max(8).describe("원문에 실제로 존재하는 짧은 예문. 관찰 없음/통계 등에는 빈 배열. URL과 출처 표기 금지."),
  application: z.string().max(2000).describe("이 표현 방식을 새 소재에 재사용하는 구체적인 작성 규칙. 프로필/대상/통계 등 적용 규칙이 불필요하면 빈 문자열."),
}).strict();

export const synthesisSchema = z.object({
  content: z.object(Object.fromEntries(personaSections.filter(s => s.id !== "instructions").map(section => [
    section.id, z.object(Object.fromEntries(Object.entries(section.fields).map(([key, label]) => [
      key, fieldSchema(questions[section.id][key]).describe(section.label + " / " + label),
    ]))).strict(),
  ]))).strict(),
}).strict();

export function analysisQuestions() {
  return personaSections.filter(s => s.id !== "instructions").map(s =>
    s.label + "\n" + Object.entries(s.fields).map(([key, label]) => `${s.id}.${key} — ${label}: ${questions[s.id][key]}`).join("\n"),
  ).join("\n\n");
}

export function renderAnalysis(result: z.infer<typeof synthesisSchema>): PersonaContent {
  const content: PersonaContent = {};
  for (const [section, fields] of Object.entries(result.content)) {
    content[section] = Object.fromEntries(Object.entries(fields).map(([key, field]) => [
      key, [field.observation.replaceAll("\\n", "\n"), field.examples.length ? "예문\n" + field.examples.map(e => "• " + e).join("\n") : "", field.application ? "제작 적용: " + field.application : ""].filter(Boolean).join("\n\n"),
    ]));
  }
  content.instructions = { instructions: "" };
  return content;
}
