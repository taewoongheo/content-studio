export const contentTypes = [
  {
    id: "slideshow",
    title: "슬라이드",
    description: "여러 장의 이미지로 흐름을 만드는 TikTok 콘텐츠입니다.",
  },
  {
    id: "video",
    title: "영상",
    description: "장면과 시간 흐름으로 구성하는 TikTok 콘텐츠입니다.",
  },
] as const;

export type ContentType = (typeof contentTypes)[number]["id"];

export const creationMethods = [
  {
    id: "reference",
    title: "레퍼런스 기반",
    description: "참고 콘텐츠의 구조와 표현 패턴을 분석해 적용합니다.",
  },
  {
    id: "template",
    title: "템플릿 기반",
    description: "정해진 콘텐츠 구조에 제품과 주제를 맞춰 구성합니다.",
  },
  {
    id: "scratch",
    title: "처음부터 생성",
    description: "참고 자료 없이 제품 정보와 조사 결과로 시작합니다.",
  },
] as const;

export type CreationMethod = (typeof creationMethods)[number]["id"];

export function isImplementedWorkflow(
  type: ContentType,
  method: CreationMethod,
) {
  return type === "slideshow" && method === "reference";
}

export function getWorkflowLabel(
  type: ContentType,
  method: CreationMethod,
) {
  const typeLabel = contentTypes.find((item) => item.id === type)?.title;
  const methodLabel = creationMethods.find((item) => item.id === method)?.title;
  return `${typeLabel} · ${methodLabel}`;
}
