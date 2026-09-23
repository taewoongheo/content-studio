"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StrategyOutput } from "@/lib/content-jobs/structured-output/contracts";
import { ReviewShell } from "../review-shell";

export function StrategyReview({
  value,
  disabled,
  onApprove,
}: {
  value: StrategyOutput;
  disabled: boolean;
  onApprove: (value: StrategyOutput, selectedId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  const [selectedId, setSelectedId] = useState(value.strategies[0]?.id ?? "");

  function updateStrategy(
    index: number,
    patch: Partial<StrategyOutput["strategies"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      strategies: current.strategies.map((strategy, strategyIndex) =>
        strategyIndex === index ? { ...strategy, ...patch } : strategy,
      ),
    }));
  }

  return (
    <ReviewShell
      step="2 / 4 · 적용 전략"
      title="콘텐츠 방향을 하나 선택하세요"
      description="현재 조사 근거와 승인한 레퍼런스 패턴을 결합한 세 가지 방향입니다. 선택 전에 주제와 슬라이드 계획을 수정할 수 있습니다."
    >
      <div className="grid gap-4">
        {draft.strategies.map((strategy, index) => (
          <section
            key={strategy.id}
            className="grid gap-5 rounded-lg border p-6 has-[:checked]:border-foreground has-[:checked]:ring-1 has-[:checked]:ring-foreground max-md:p-4"
          >
            <label className="flex w-fit cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="strategy"
                value={strategy.id}
                checked={selectedId === strategy.id}
                onChange={() => setSelectedId(strategy.id)}
                className="size-4"
              />
              <span className="font-semibold">전략 {index + 1}</span>
            </label>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="주제">
                <Input
                  value={strategy.topic}
                  onChange={(event) =>
                    updateStrategy(index, { topic: event.target.value })
                  }
                />
              </Field>
              <Field label="콘텐츠 각도">
                <Input
                  value={strategy.angle}
                  onChange={(event) =>
                    updateStrategy(index, { angle: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="레퍼런스 적용 이유">
              <Textarea
                value={strategy.referenceFit}
                onChange={(event) =>
                  updateStrategy(index, { referenceFit: event.target.value })
                }
              />
            </Field>
            <div className="grid gap-3 border-t pt-4">
              <p className="text-sm font-medium">슬라이드 계획</p>
              {strategy.slidePlan.map((slide, slideIndex) => (
                <div
                  key={slide.id}
                  className="grid grid-cols-[3rem_1fr_2fr] items-start gap-3 max-md:grid-cols-1"
                >
                  <span className="pt-2 text-sm text-muted-foreground">
                    {slideIndex + 1}장
                  </span>
                  <Input
                    aria-label={`${slideIndex + 1}장 역할`}
                    value={slide.role}
                    onChange={(event) =>
                      updateStrategy(index, {
                        slidePlan: strategy.slidePlan.map((item, itemIndex) =>
                          itemIndex === slideIndex
                            ? { ...item, role: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <Textarea
                    aria-label={`${slideIndex + 1}장 핵심 내용`}
                    value={slide.productFact}
                    onChange={(event) =>
                      updateStrategy(index, {
                        slidePlan: strategy.slidePlan.map((item, itemIndex) =>
                          itemIndex === slideIndex
                            ? { ...item, productFact: event.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <StrategyEvidence strategy={strategy} evidence={draft.evidence} />
          </section>
        ))}
      </div>
      <div className="flex justify-end border-t pt-6">
        <Button
          className="h-11 px-5"
          disabled={disabled || !selectedId}
          onClick={() => void onApprove(draft, selectedId)}
        >
          선택하고 본문 만들기
        </Button>
      </div>
    </ReviewShell>
  );
}

function StrategyEvidence({
  strategy,
  evidence,
}: {
  strategy: StrategyOutput["strategies"][number];
  evidence: StrategyOutput["evidence"];
}) {
  const evidenceIds = new Set(
    strategy.slidePlan.flatMap((slide) => slide.evidenceIds),
  );
  const matching = evidence.filter((item) => evidenceIds.has(item.id));

  return (
    <div className="grid gap-3 border-t pt-4">
      <h2 className="text-sm font-medium">조사 근거</h2>
      {matching.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          연결된 조사 근거가 없습니다.
        </p>
      ) : (
        matching.map((item) => (
          <div key={item.id} className="grid gap-1 text-sm">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="w-fit font-medium underline underline-offset-4"
            >
              {item.title}
            </a>
            <p className="leading-6 text-muted-foreground">{item.summary}</p>
          </div>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </span>
  );
}
