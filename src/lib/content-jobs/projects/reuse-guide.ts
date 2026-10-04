import * as z from "zod/v4";

export const REUSE_GUIDE_FIELDS = [
  { key: "contentRole", label: "콘텐츠 역할", description: "독자를 위해 하는 일. 비교·설명·교정·구성 등 역할은 자유롭게 작성합니다.", placeholder: "운동 선택지와 수행량을 안내해 루틴을 구성하도록 돕는다." },
  { key: "readerOutcome", label: "독자가 얻을 결과", description: "읽고 나서 무엇을 판단·이해·실행할 수 있는지 작성합니다.", placeholder: "목적에 맞는 운동을 골라 실제 루틴을 만들 수 있다." },
  { key: "requiredInformation", label: "필요한 정보", description: "콘텐츠 역할을 수행하는 데 필요한 내용을 작성합니다.", placeholder: "운동 그룹의 목적, 선택지, 선택 방법, 세트·횟수." },
  { key: "selectionCriteria", label: "선택 기준", description: "적합한 요청과 비슷한 역할의 다른 템플릿과의 차이를 작성합니다.", placeholder: "실제 운동 구성 요청에 적합하다. 운동 순위 평가나 습관 교정과 구분한다." },
] as const;

const field = (description: string) => z.string().trim().max(1000).describe(description);
export const reuseGuideValueSchema = z.strictObject({
  contentRole: field("What the content does for the reader; roles are unrestricted, not a fixed type enum."),
  readerOutcome: field("What the reader can decide, understand or do after reading."),
  requiredInformation: field("Information needed to fulfill the content role."),
  selectionCriteria: field("Suitable requests and how this role differs from similar templates."),
});
export type ReuseGuide = z.infer<typeof reuseGuideValueSchema>;
export const emptyReuseGuide = (): ReuseGuide => ({ contentRole: "", readerOutcome: "", requiredInformation: "", selectionCriteria: "" });
export function hasCompleteReuseGuide(guide: ReuseGuide | null | undefined): guide is ReuseGuide {
  return !!guide && REUSE_GUIDE_FIELDS.every(({ key }) => guide[key].trim().length > 0);
}
export const completeReuseGuideSchema = reuseGuideValueSchema.extend({
  contentRole: reuseGuideValueSchema.shape.contentRole.min(1),
  readerOutcome: reuseGuideValueSchema.shape.readerOutcome.min(1),
  requiredInformation: reuseGuideValueSchema.shape.requiredInformation.min(1),
  selectionCriteria: reuseGuideValueSchema.shape.selectionCriteria.min(1),
});
export const projectReuseUpdateSchema = z.strictObject({
  reuseGuide: reuseGuideValueSchema.nullable().optional(),
  isTemplate: z.boolean().optional(),
}).refine(input => input.reuseGuide !== undefined || input.isTemplate !== undefined, {
  message: "변경할 재사용 설정을 입력해 주세요.",
});
export type ProjectReuseUpdate = z.infer<typeof projectReuseUpdateSchema>;
