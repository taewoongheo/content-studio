"use client";
import { useState } from "react";
import Image from "next/image";
import type { Row } from "@/domains/content-production/domain/contracts";
const fields: Record<string, string> = {
  analysis: "분석",
  topic: "소재",
  content_type: "유형",
  message: "메시지",
  answer: "제공할 답",
  presentation: "표현 방향",
  reason: "선택 이유",
  expected_response: "기대 반응",
  goal_connection: "목표와의 연결",
  difference_from_recent: "최근 콘텐츠와 다른 가치",
};
type Action = (input: Record<string, unknown>) => Promise<unknown>;
export function LibraryPanel({
  logs,
  references,
  visuals,
  act,
  onOpen,
}: {
  logs: Row[];
  references: Row[];
  visuals: Row[];
  act: Action;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState("logs"),
    [editing, setEditing] = useState<Row | null>(null),
    [reference, setReference] = useState(false),
    [error, setError] = useState("");
  const safe = async (callback: () => Promise<unknown>) => {
    try {
      setError("");
      await callback();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    }
  };
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-5">
          <button
            className={`text-sm ${tab === "logs" ? "font-semibold" : "text-muted-foreground"}`}
            onClick={() => setTab("logs")}
          >
            제작 기록 <span className="ml-1 text-xs">{logs.length}</span>
          </button>
          <button
            className={`text-sm ${tab === "references" ? "font-semibold" : "text-muted-foreground"}`}
            onClick={() => setTab("references")}
          >
            선별 레퍼런스{" "}
            <span className="ml-1 text-xs">{references.length}</span>
          </button>
        </div>
        {tab === "references" && (
          <button
            className="production-button"
            onClick={() => setReference(!reference)}
          >
            레퍼런스 등록
          </button>
        )}
      </div>
      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {reference && tab === "references" && (
        <form
          className="mt-5 grid gap-3 rounded-xl border p-5 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const project_id = String(f.get("project_id") || "");
            void safe(async () => {
              await act({
                action: "reference",
                reference: {
                  title: f.get("title"),
                  topic: f.get("topic"),
                  content_type: f.get("content_type"),
                  ...(project_id
                    ? { project_id }
                    : { source_url: f.get("url") }),
                  parts: [
                    {
                      aspect: f.get("aspect"),
                      location: f.get("location"),
                      reason: f.get("reason"),
                      usage_context: f.get("usage_context"),
                    },
                  ],
                },
              });
              setReference(false);
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
          <button className="production-button primary md:col-span-2">
            등록
          </button>
        </form>
      )}
      {tab === "logs" ? (
        <div className="mt-4 divide-y rounded-xl border">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              아직 제작 기록이 없습니다.
            </p>
          ) : (
            logs.map((log) => (
              <article key={String(log.id)} className="p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {String(log.name ?? log.topic ?? "진행 중인 콘텐츠")}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {String(log.content_type ?? "유형 미입력")} ·{" "}
                      {log.completed_at ? "게시 연결 완료" : "게시 정보 미등록"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!!log.project_id && (
                      <button
                        className="production-button"
                        onClick={() => onOpen(String(log.project_id))}
                      >
                        포스트 열기
                      </button>
                    )}
                    <button
                      className="production-button"
                      onClick={() =>
                        setEditing(editing?.id === log.id ? null : log)
                      }
                    >
                      정보 편집
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {String(log.message ?? "")}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {[
                    ["view_count", "조회"],
                    ["like_count", "좋아요"],
                    ["comment_count", "댓글"],
                    ["save_count", "저장"],
                    ["share_count", "공유"],
                  ].map(([key, label]) => (
                    <span key={key}>
                      {label}{" "}
                      {log[key] === null || log[key] === undefined
                        ? "—"
                        : Number(log[key]).toLocaleString()}
                    </span>
                  ))}
                </div>
                {!!log.observed_at && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    관측:{" "}
                    {new Date(String(log.observed_at)).toLocaleString("ko-KR")}
                  </p>
                )}
                {editing?.id === log.id && (
                  <form
                    className="mt-5 grid gap-4 md:grid-cols-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const patch = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      void safe(async () => {
                        await act({ action: "edit_log", id: log.id, patch });
                        setEditing(null);
                      });
                    }}
                  >
                    {Object.entries(fields).map(([name, label]) => (
                      <label
                        key={name}
                        className="text-xs"
                        htmlFor={`log-${log.id}-${name}`}
                      >
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
                      기존 자료의 빈 정보를 직접 보완합니다. 에이전트가 생성한
                      기록으로 표시하지 않습니다.
                    </p>
                    <button className="production-button primary md:col-span-2">
                      정보 저장
                    </button>
                  </form>
                )}
                {!log.completed_at && (
                  <form
                    className="mt-4 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const url = new FormData(e.currentTarget).get("url");
                      void safe(() =>
                        act({ action: "register", id: log.id, url }),
                      );
                    }}
                  >
                    <input
                      className="production-field"
                      name="url"
                      type="url"
                      placeholder="업로드한 TikTok URL"
                      aria-label={`${String(log.name ?? log.id)} 게시 URL`}
                      required
                    />
                    <button className="production-button whitespace-nowrap">
                      URL 등록
                    </button>
                  </form>
                )}
                {visuals
                  .filter((v) => v.log_id === log.id)
                  .map((v) => (
                    <details key={String(v.id)} className="mt-3 text-xs">
                      <summary className="cursor-pointer">
                        게시 당시 전체 슬라이드 ({String(v.slide_count)}장)
                      </summary>
                      <div className="mt-3 flex gap-3 overflow-auto">
                        {Array.from(
                          { length: Number(v.slide_count) },
                          (_, i) => (
                            <Image
                              unoptimized
                              key={i}
                              src={`/api/content-production?image=${encodeURIComponent(String(v.id))}&slide=${i}`}
                              alt={`게시 슬라이드 ${i + 1}`}
                              width={216}
                              height={270}
                              className="h-auto w-44 shrink-0 rounded border"
                              loading="lazy"
                            />
                          ),
                        )}
                      </div>
                    </details>
                  ))}
              </article>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {references.map((ref) => (
            <article key={String(ref.id)} className="rounded-xl border p-5">
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold text-sm">{String(ref.title)}</h3>
                <button
                  className="text-xs text-muted-foreground"
                  onClick={() =>
                    void safe(() =>
                      act({ action: "remove_reference", id: ref.id }),
                    )
                  }
                >
                  제거
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {String(ref.topic)} · {String(ref.content_type)}
              </p>
              <pre className="mt-3 whitespace-pre-wrap text-xs leading-6">
                {JSON.stringify(ref.parts, null, 2)}
              </pre>
              {!!ref.project_id && (
                <button
                  className="production-button mt-3"
                  onClick={() => onOpen(String(ref.project_id))}
                >
                  원본 열기
                </button>
              )}
              {!!ref.source_url && (
                <a
                  className="mt-3 block text-xs underline"
                  href={String(ref.source_url)}
                  target="_blank"
                  rel="noreferrer"
                >
                  원본 게시물
                </a>
              )}
            </article>
          ))}
          {references.length === 0 && (
            <p className="text-sm text-muted-foreground">
              별도로 선별해 저장한 레퍼런스가 없습니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
