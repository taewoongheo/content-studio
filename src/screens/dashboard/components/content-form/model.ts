export const contentTypes = [
  {
    id: "slideshow",
    title: "슬라이드쇼",
    description:
      "여러 장의 이미지로 이야기를 전달합니다. 참고 이미지, 슬라이드 수와 비율을 설정할 수 있습니다.",
  },
  {
    id: "video",
    title: "영상",
    description:
      "장면과 흐름이 있는 콘텐츠를 준비합니다. 참고 영상이나 대본, 목표 길이와 비율을 설정할 수 있습니다.",
  },
  {
    id: "text",
    title: "텍스트",
    description:
      "SNS 게시글이나 소개 글을 준비합니다. 참고할 원문, 글 유형과 목표 분량을 설정할 수 있습니다.",
  },
] as const;
export type ContentType = (typeof contentTypes)[number]["id"];
export const creationMethods = [
  {
    id: "reference",
    title: "레퍼런스 기반",
    description: "참고 자료의 구성과 표현 방식을 활용합니다.",
  },
  {
    id: "template",
    title: "템플릿 기반",
    description: "준비된 글의 구성에 제품 정보를 담습니다.",
  },
  {
    id: "scratch",
    title: "처음부터 만들기",
    description: "참고 자료 없이 제품 정보와 아이디어로 시작합니다.",
  },
] as const;
export type Method = (typeof creationMethods)[number]["id"];
export const templates = ["문제 → 해결", "핵심 팁 리스트", "단계별 가이드"];

export type Materials = {
  reference: string;
  referenceText: string;
  files: File[];
  template: string;
  notes: string;
};

export type ContentSettings = {
  ratio: string;
  count: string;
  videoRatio: string;
  duration: string;
  channel: string;
  length: string;
  language: string;
};

export function getSettingsSummary(
  type: ContentType,
  settings: ContentSettings,
) {
  const { ratio, count, videoRatio, duration, channel, length, language } =
    settings;
  const formats = {
    slideshow: `${ratio} · ${count}`,
    video: `${videoRatio} · ${duration}`,
    text: `${channel} · ${length}`,
  };
  return `${formats[type]} · ${language}`;
}
