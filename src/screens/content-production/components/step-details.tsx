"use client";
import { useEffect, useState } from "react";
import type {
  ProductionStep,
  WorkDetail,
} from "@/domains/content-production/domain/contracts";
const labels: Record<string, string> = {
  analysis: "분석",
  topic: "소재",
  content_type: "유형",
  message: "메시지",
  answer: "제공할 답",
  presentation: "표현 방향",
  reason: "선택 이유",
  expected_response: "기대 반응",
  goal_connection: "목표와의 연결",
  difference_from_recent: "새로운 가치",
  research: "조사 결과",
  sources: "참고 자료",
  content: "작성 중인 내용",
  completed_actions: "완료한 일",
  remaining_actions: "남은 일",
  direction_changes: "추가 조사에 따른 변경",
  error: "오류",
};
export function StepDetails({
  id,
  step,
  updated,
  write,
  onClose,
  readWork,
}: {
  id: string;
  step: ProductionStep;
  updated: string;
  write: number;
  onClose: () => void;
  readWork: (id: string) => Promise<WorkDetail>;
}) {
  const [detail, setDetail] = useState<WorkDetail | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    readWork(id)
      .then((value) => {
        if (active) {
          setDetail(value);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(String(e.message));
      });
    return () => {
      active = false;
    };
  }, [id, step, updated, write, readWork]);
  const context = step === "analysis" ? detail?.analysis : detail?.production;
  return (
    <section
      className="production-details p-5"
      aria-label="단계 상세"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {id.slice(0, 8)} · {String(context?.state ?? "pending")}
          </p>
          <h3 className="mt-1 font-semibold">
            {step === "analysis" ? "분석 및 제작 방향" : "콘텐츠 제작"}
          </h3>
        </div>
        <button className="production-button" onClick={onClose}>
          닫기
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      {!context ? (
        <p className="mt-5 text-sm text-muted-foreground">
          이 단계는 아직 시작되지 않았습니다.
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            마지막 저장:{" "}
            {new Date(String(context.updated_at)).toLocaleString("ko-KR")}
          </p>
          <div className="mt-5 grid gap-5">
            {Object.entries(labels)
              .filter(
                ([key]) =>
                  context[key] !== undefined &&
                  context[key] !== null &&
                  context[key] !== "",
              )
              .map(([key, label]) => (
                <div key={key} className="min-w-0 rounded-lg bg-muted/35 p-4">
                  <h4 className="mb-2 text-xs font-semibold">{label}</h4>
                  <pre>
                    {typeof context[key] === "string"
                      ? String(context[key])
                      : JSON.stringify(context[key], null, 2)}
                  </pre>
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
