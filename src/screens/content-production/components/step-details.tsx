"use client";
import { ReferenceCard } from "./library/reference-card";
import { useEffect, useState } from "react";
import { StructuredValue } from "./details/structured-value";
import { StatusIcon } from "./workflow/status-icon";
import { useDisplayTranslation } from "../hooks/display/use-display-translation";
import type {
  ProductionStep,
  WorkDetail,
} from "@/domains/content-production/domain/contracts";
import { productionSteps } from "../model/task-controls";
const labels: Record<string, string> = {
  analysis: "분석",
  review: "검토 결과",
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
  const context = detail?.[step];
  const external = detail?.external?.[step === "production" ? "analysis" : step];
  const [original, setOriginal] = useState(false);
  const translation = useDisplayTranslation(id, step, context, !original);
  const visible = !original && translation.translated ? { ...context, ...translation.translated } : context;
  return (
    <section
      className="production-details p-5"
      aria-label="단계 상세"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <StatusIcon state={String(context?.state ?? "pending")} size={16} />
            {productionSteps.find(value => value.id === step)?.label}
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
          <div className="mt-3 flex items-center gap-3 text-xs">
            <button className="production-button" onClick={() => setOriginal(value => !value)}>{original ? "한국어 보기" : "영어 원문"}</button>
            {!original && <span role="status" className="text-muted-foreground">{translation.loading ? "한국어 번역 중…" : translation.translated ? "화면용 번역" : "영어 원문 표시 중"}</span>}
          </div>
          {!original && translation.error && <p role="alert" className="mt-2 text-xs text-destructive">{translation.error}<button className="ml-2 underline" onClick={translation.retry}>다시 번역</button></p>}
          {external && <section className="mt-5 space-y-3" aria-label="이번 단계 외부 레퍼런스">
            <h4 className="text-sm font-semibold">외부 레퍼런스 · {external.posts.length}/3</h4>
            {!external.posts.length && <p className="text-xs text-muted-foreground">일치하는 자료 없음{external.collection_attempted ? " · 추가 수집 확인" : ""}</p>}
            {external.posts.map(post=><ReferenceCard key={String(post.id)} post={post} />)}
          </section>}
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
                  <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold">{label}{!original && translation.pendingFields.has(key) && <span role="status" className="font-normal text-muted-foreground">번역 중…</span>}</h4>
                  <StructuredValue value={visible?.[key]} field={key} />
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
