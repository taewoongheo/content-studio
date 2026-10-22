"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Play, RefreshCw } from "lucide-react";
import { useProduction } from "./hooks/use-production";
import { StepDetails } from "./components/step-details";
import { LibraryPanel } from "./components/library-panel";
import type { ProductionStep } from "@/domains/content-production/domain/contracts";
import "./production.css";
const WorkflowCanvas = dynamic(
  () => import("./components/workflow-canvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <div className="production-canvas" /> },
);
export function ContentProductionScreen({
  onOpen,
}: {
  onOpen: (id: string) => Promise<void>;
}) {
  const { data, error, busy, writes, activity, reload, act } = useProduction();
  const [count, setCount] = useState(4),
    [selected, setSelected] = useState<{
      id: string;
      step: ProductionStep;
    } | null>(null);
  const safe = (action: Record<string, unknown>) => {
    void act(action).catch(() => {});
  };
  const current = data?.tasks.find((t) => t.id === selected?.id);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-muted-foreground">
            Content production
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            콘텐츠 제작
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            이전 기록과 레퍼런스를 읽고, 콘텐츠마다 독립적으로 제작합니다.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            safe({ action: "start", count });
          }}
        >
          <label
            className="text-xs text-muted-foreground"
            htmlFor="production-count"
          >
            제작 개수
          </label>
          <input
            id="production-count"
            className="production-field !w-16"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            required
          />
          <button
            className="production-button primary"
            disabled={busy || data?.sync.running}
          >
            <Play size={14} />
            {data?.sync.running ? "성과 갱신 중" : "시작"}
          </button>
          <button
            type="button"
            className="production-button"
            aria-label="새로고침"
            onClick={() => void reload()}
          >
            <RefreshCw size={14} />
          </button>
        </form>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {data && !data.configured.apify && (
        <p className="text-xs text-muted-foreground">
          Apify 미연결 · 성과 수집과 외부 자료 조회에는 서버의 APIFY_API_TOKEN이
          필요합니다.
        </p>
      )}
      <WorkflowCanvas
        tasks={data?.tasks ?? []}
        writes={writes}
        activity={activity}
        syncing={data?.sync.running ?? false}
        onSelect={(id, step) => setSelected({ id, step })}
        onOpen={(id) => void onOpen(id)}
      />
      {!!data?.tasks.length && (
        <div className="flex flex-wrap gap-3">
          {data.tasks.map((task, i) => (
            <div
              key={task.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
            >
              <span className="font-medium">
                {String(i + 1).padStart(2, "0")} ·{" "}
                {task.topic ?? "소재 분석 중"}
              </span>
              {["running", "pending"].includes(task.state) && (
                <button
                  className="production-button"
                  disabled={busy}
                  onClick={() => safe({ action: "stop", id: task.id })}
                >
                  중단
                </button>
              )}
              {["stopped", "failed"].includes(task.state) && (
                <button
                  className="production-button"
                  disabled={busy}
                  onClick={() => safe({ action: "resume", id: task.id })}
                >
                  재개
                </button>
              )}
              <button
                className="production-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "이 작업의 모든 draft를 삭제할까요? 저장된 포스트는 유지됩니다.",
                    )
                  )
                    safe({ action: "remove", id: task.id });
                }}
              >
                취소·제거
              </button>
            </div>
          ))}
        </div>
      )}
      {selected && current && (
        <StepDetails
          id={selected.id}
          step={selected.step}
          updated={current.updated_at}
          write={writes[`${selected.id}:${selected.step}`] ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
      {data && (
        <LibraryPanel
          logs={data.logs}
          references={data.references}
          visuals={data.visuals}
          act={act}
          onOpen={(id) => void onOpen(id)}
        />
      )}
      {data && (
        <form
          className="mt-10 flex flex-wrap items-end gap-3 border-t pt-6"
          key={data.settings.model}
          onSubmit={(event) => {
            event.preventDefault();
            const model = new FormData(event.currentTarget).get("model");
            safe({ action: "settings", settings: { model } });
          }}
        >
          <label
            className="text-xs text-muted-foreground"
            htmlFor="production-model"
          >
            제작용 Codex 모델
            <input
              id="production-model"
              name="model"
              className="production-field mt-2 !w-64"
              defaultValue={data.settings.model}
              required
            />
          </label>
          <button className="production-button" disabled={busy}>
            모델 저장
          </button>
          <p className="w-full text-xs text-muted-foreground">
            새 시작·재개부터 적용합니다. 전역 Codex 설정은 유지합니다.
          </p>
        </form>
      )}
    </div>
  );
}
