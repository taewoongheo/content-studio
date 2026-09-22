"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AcceptedHookOutput,
  CopyOutput,
  HookOutput,
  ReferenceAnalysisOutput,
  StrategyOutput,
} from "@/lib/content-jobs/contracts";
import type { ContentJobSnapshot } from "@/lib/content-jobs/types";
import { CopyReview } from "./components/copy-review";
import { FinalEditor } from "./components/final-editor";
import { HookReview } from "./components/hook-review";
import { ReferenceReview } from "./components/reference-review";
import { StrategyReview } from "./components/strategy-review";
import { useContentJob } from "./use-content-job";

const runningCopy: Record<string, [string, string]> = {
  analyzing_reference: [
    "레퍼런스를 분석하고 있습니다",
    "이미지의 구조, 시각 언어, 전개 방식과 훅 패턴을 읽고 있습니다.",
  ],
  researching_strategy: [
    "주제와 전략을 조사하고 있습니다",
    "현재 자료를 조사하고 레퍼런스 패턴을 적용할 세 가지 방향을 만들고 있습니다.",
  ],
  drafting_copy: [
    "본문 카피를 작성하고 있습니다",
    "승인한 전략에 맞춰 슬라이드별 역할과 문장을 구성하고 있습니다.",
  ],
  generating_hooks: [
    "훅 후보를 만들고 있습니다",
    "본문이 실제로 뒷받침할 수 있는 네 가지 첫 문장을 비교하고 있습니다.",
  ],
};

export function ContentJobScreen({
  initialJob,
  onNewJob,
}: {
  initialJob: ContentJobSnapshot;
  onNewJob: () => void;
}) {
  const { job, submitting, clientError, send } = useContentJob(initialJob);
  const status = job.state.status;
  const issue = clientError || job.lastError;

  async function approveAndGenerate(
    acceptBody: Record<string, unknown>,
    generationAction: string,
  ) {
    try {
      await send(acceptBody);
      await send({ action: generationAction });
    } catch {
      // The hook exposes the actionable error next to the current stage.
    }
  }

  const running = runningCopy[status];
  return (
    <div className="mx-auto grid max-w-[900px] gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="진행 단계">
          {["레퍼런스", "전략", "본문", "훅"].map((label, index) => (
            <li key={label} className="rounded-full border px-3 py-1.5">
              {index + 1}. {label}
            </li>
          ))}
        </ol>
        <Button variant="ghost" onClick={onNewJob}>
          새 작업
        </Button>
      </div>

      {issue && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{issue}</span>
        </div>
      )}

      {running ? (
        <section className="grid min-h-72 place-items-center rounded-lg border p-8 text-center" aria-live="polite">
          <div className="grid max-w-lg justify-items-center gap-3">
            <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <h1 className="text-xl font-semibold">{running[0]}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{running[1]}</p>
            <p className="text-xs text-muted-foreground">
              {job.referenceImages.length}개 레퍼런스 · {job.aspectRatio} · {job.slideCount}장 · {job.outputLanguage}
            </p>
          </div>
        </section>
      ) : status === "reviewing_reference" && job.state.reference.proposal ? (
        <ReferenceReview
          key={`reference-${job.state.revision}`}
          value={job.state.reference.proposal as ReferenceAnalysisOutput}
          disabled={submitting || Boolean(job.activeOperation)}
          onApprove={(value) =>
            approveAndGenerate(
              {
                action: "accept_reference",
                value,
                expectedRevision: job.state.revision,
              },
              "generate_strategies",
            )
          }
        />
      ) : status === "reviewing_strategy" && job.state.strategy.proposal ? (
        <StrategyReview
          key={`strategy-${job.state.revision}`}
          value={job.state.strategy.proposal as StrategyOutput}
          disabled={submitting || Boolean(job.activeOperation)}
          onApprove={(value, selectedId) =>
            approveAndGenerate(
              {
                action: "accept_strategy",
                value,
                selectedId,
                expectedRevision: job.state.revision,
              },
              "generate_copy",
            )
          }
        />
      ) : status === "reviewing_copy" && job.state.copy.proposal ? (
        <CopyReview
          key={`copy-${job.state.revision}`}
          value={job.state.copy.proposal as CopyOutput}
          disabled={submitting || Boolean(job.activeOperation)}
          onApprove={(value) =>
            approveAndGenerate(
              {
                action: "accept_copy",
                value,
                expectedRevision: job.state.revision,
              },
              "generate_hooks",
            )
          }
        />
      ) : status === "reviewing_hooks" && job.state.hooks.proposal ? (
        <HookReview
          key={`hooks-${job.state.revision}`}
          value={job.state.hooks.proposal as HookOutput}
          disabled={submitting || Boolean(job.activeOperation)}
          onApprove={async (value, selectedId) => {
            try {
              await send({
                action: "accept_hook",
                value,
                selectedId,
                expectedRevision: job.state.revision,
              });
            } catch {
              // The hook exposes the actionable error next to the editor.
            }
          }}
        />
      ) : status === "completed" &&
        job.state.copy.accepted &&
        job.state.hooks.accepted ? (
        <FinalEditor
          key={`final-${job.state.revision}`}
          copy={job.state.copy.accepted as CopyOutput}
          hooks={job.state.hooks.accepted as AcceptedHookOutput}
          disabled={submitting}
          onSave={async (copy, hooks, selectedId) => {
            try {
              await send({
                action: "revise_final",
                copy,
                hooks,
                selectedId,
                expectedRevision: job.state.revision,
              });
            } catch {
              // The hook exposes the actionable error next to the editor.
            }
          }}
        />
      ) : (
        <section className="grid gap-4 rounded-lg border p-8">
          <h1 className="text-xl font-semibold">작업을 이어갈 수 없습니다</h1>
          <p className="text-sm text-muted-foreground">
            현재 단계의 결과가 없습니다. 새 작업을 시작하거나 다시 시도해 주세요.
          </p>
        </section>
      )}
    </div>
  );
}
