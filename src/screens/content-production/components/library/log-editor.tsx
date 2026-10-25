"use client";
import type { Row } from "@/domains/content-production/domain/contracts";
const fields: Record<string, string> = {
  analysis: "분석",
  topic: "소재",
  content_type: "포맷",
  message: "메시지",
  answer: "제공할 답",
  presentation: "표현 방향",
  reason: "선택 이유",
  expected_response: "기대 반응",
  goal_connection: "목표와의 연결",
  difference_from_recent: "최근 콘텐츠와 다른 가치",
};
export function LogEditor({
  log,
  onSave,
}: {
  log: Row;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="mt-5 grid gap-4 md:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(Object.fromEntries(new FormData(event.currentTarget)));
      }}
    >
      {Object.entries(fields).map(([name, label]) => (
        <label key={name} className="text-xs" htmlFor={`log-${log.id}-${name}`}>
          {label}
          <textarea
            className="production-field mt-1"
            rows={2}
            name={name}
            id={`log-${log.id}-${name}`}
            defaultValue={String(log[name] ?? "")}
          />
        </label>
      ))}
      <p className="text-xs text-muted-foreground md:col-span-2">
        기존 자료의 빈 정보를 직접 보완합니다. 에이전트가 생성한 기록으로
        표시하지 않습니다.
      </p>
      <button className="production-button primary md:col-span-2">
        정보 저장
      </button>
    </form>
  );
}
