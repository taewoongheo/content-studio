"use client";
import { LogEditor } from "./log-editor";
import { ReferenceForm } from "./reference-form";
import { StructuredValue } from "../details/structured-value";
import { useState } from "react";
import Image from "next/image";
import type { Row } from "@/domains/content-production/domain/contracts";
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
    <section className="min-w-0">
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
        <ReferenceForm
          logs={logs}
          onSave={(input) =>
            void safe(async () => {
              await act({ action: "reference", reference: input });
              setReference(false);
            })
          }
        />
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
                  <LogEditor
                    log={log}
                    onSave={(patch) =>
                      void safe(async () => {
                        await act({ action: "edit_log", id: log.id, patch });
                        setEditing(null);
                      })
                    }
                  />
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
                      게시
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
              <div className="mt-3"><StructuredValue value={ref.parts} /></div>
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
