"use client";
import { LogEditor } from "./log-editor";
import { ExternalLibrary } from "./external-library";
import { useState } from "react";
import Image from "next/image";
import type { Row } from "@/domains/content-production/domain/contracts";
type Action = (input: Record<string, unknown>) => Promise<unknown>;
export function LibraryPanel({
  logs,
  externalReferences,
  referenceAccounts,
  visuals,
  act,
  onOpen,
}: {
  logs: Row[];
  externalReferences: Row[];
  referenceAccounts: Row[];
  visuals: Row[];
  act: Action;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState("logs"),
    [editing, setEditing] = useState<Row | null>(null),
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
            외부 레퍼런스{" "}
            <span className="ml-1 text-xs">{externalReferences.filter(post=>!post.excluded).length}</span>
          </button>
        </div>

      </div>
      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
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
                      {String(log.content_type ?? "포맷 미입력")} ·{" "}
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
        <ExternalLibrary posts={externalReferences} accounts={referenceAccounts} act={act} />
      )}
    </section>
  );
}
