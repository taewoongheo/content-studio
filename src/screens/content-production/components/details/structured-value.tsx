import type { ReactNode } from "react";

const labels: Record<string, string> = {
  question: "조사 질문", source: "출처", finding: "발견한 내용", judgment: "판단",
  kind: "자료 유형", id: "자료 ID", url: "링크", part: "참고한 부분", used_for: "활용 목적",
  visual_set_id: "이미지 모음 ID", aspect: "참고 요소", location: "위치",
  reason: "선택 이유", usage_context: "활용 상황", hook: "훅", body: "본문", cta: "CTA",
  visual: "시각 표현", slides: "슬라이드", title: "제목", text: "내용", role: "역할",
  topic: "소재", message: "메시지", answer: "제공할 답", summary: "요약",
  content_type: "유형", presentation: "표현 방향", caption: "캡션", hashtags: "해시태그",
  project_id: "프로젝트 ID", slide_id: "슬라이드 ID", reviewed_slide_ids: "검토한 슬라이드",
  reviewed_revision: "검토 버전", index: "순서", name: "이름", description: "설명",
};
const kinds: Record<string, string> = { log: "과거 제작 기록", reference: "외부 레퍼런스", url: "외부 자료" };
const aspects: Record<string, string> = { hook: "훅", body: "본문", cta: "CTA", visual: "시각 표현" };

function TextValue({ value, field }: { value: unknown; field?: string }) {
  const text = field === "kind" ? kinds[String(value)] ?? String(value)
    : field === "aspect" || field === "role" ? aspects[String(value)] ?? String(value)
    : typeof value === "boolean" ? value ? "예" : "아니요" : String(value);
  if (/^https?:\/\/\S+$/i.test(text)) return <a href={text} target="_blank" rel="noreferrer" className="break-all text-primary underline underline-offset-4">{text}</a>;
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</span>;
}

/** Display arbitrary draft content without assuming a fixed content-generation schema. */
export function StructuredValue({ value, field }: { value: unknown; field?: string }): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">내용 없음</span>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className="text-muted-foreground">항목 없음</span>;
    if (value.every(item => item === null || typeof item !== "object")) return <ul className="list-disc space-y-2 pl-5 text-sm leading-6">{value.map((item, index) => <li key={index}><StructuredValue value={item} /></li>)}</ul>;
    return <div className="grid gap-3">{value.map((item, index) => <article key={index} className="min-w-0 rounded-lg border border-border bg-background p-3">
      <p className="mb-3 text-xs font-semibold text-muted-foreground">{field === "slides" ? "슬라이드" : field === "research" ? "조사" : field === "sources" ? "자료" : "항목"} {index + 1}</p>
      <StructuredValue value={item} />
    </article>)}</div>;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return <span className="text-muted-foreground">내용 없음</span>;
    return <dl className="grid min-w-0 gap-4 text-sm leading-6">{entries.map(([key, item]) => <div key={key} className="min-w-0">
      <dt className="mb-1 text-xs font-medium text-muted-foreground">{labels[key] ?? key.replaceAll("_", " ")}</dt>
      <dd className="min-w-0"><StructuredValue value={item} field={key} /></dd>
    </div>)}</dl>;
  }
  return <div className="text-sm leading-6"><TextValue value={value} field={field} /></div>;
}
