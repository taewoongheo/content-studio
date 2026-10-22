"use client";
import type { Row } from "@/domains/content-production/domain/contracts";
export function ReferenceForm({
  logs,
  onSave,
}: {
  logs: Row[];
  onSave: (reference: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="mt-5 grid gap-3 rounded-xl border p-5 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget),
          project_id = String(f.get("project_id") || "");
        onSave({
          title: f.get("title"),
          topic: f.get("topic"),
          content_type: f.get("content_type"),
          ...(project_id ? { project_id } : { source_url: f.get("url") }),
          parts: [
            {
              aspect: f.get("aspect"),
              location: f.get("location"),
              reason: f.get("reason"),
              usage_context: f.get("usage_context"),
            },
          ],
        });
      }}
    >
      <input
        className="production-field"
        name="title"
        placeholder="이름"
        aria-label="레퍼런스 이름"
        required
      />
      <input
        className="production-field"
        name="topic"
        placeholder="소재"
        aria-label="레퍼런스 소재"
        required
      />
      <input
        className="production-field"
        name="content_type"
        placeholder="유형 (루틴 목록, 대안 비교 등)"
        aria-label="레퍼런스 유형"
        required
      />
      <select
        className="production-field"
        name="project_id"
        aria-label="자체 게시글 선택"
      >
        <option value="">외부 TikTok URL로 등록</option>
        {logs
          .filter((l) => l.project_id)
          .map((l) => (
            <option key={String(l.id)} value={String(l.project_id)}>
              {String(l.name ?? l.topic ?? l.id)}
            </option>
          ))}
      </select>
      <input
        className="production-field md:col-span-2"
        type="url"
        name="url"
        placeholder="외부 TikTok URL (자체 게시글 선택 시 생략)"
        aria-label="외부 레퍼런스 URL"
      />
      <select
        className="production-field"
        name="aspect"
        aria-label="참고할 부분"
      >
        <option value="hook">훅</option>
        <option value="body">본문</option>
        <option value="visual">시각적 표현</option>
        <option value="cta">CTA</option>
      </select>
      <input
        className="production-field"
        name="location"
        placeholder="위치 (첫 장, 전체 등)"
        aria-label="참고 위치"
        required
      />
      <textarea
        className="production-field"
        name="reason"
        placeholder="무엇이 좋은가"
        aria-label="선별 이유"
        required
      />
      <textarea
        className="production-field"
        name="usage_context"
        placeholder="어떤 콘텐츠에 활용할 만한가"
        aria-label="적용 맥락"
        required
      />
      <button className="production-button primary md:col-span-2">등록</button>
    </form>
  );
}
