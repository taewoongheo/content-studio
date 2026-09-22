"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CopyOutput } from "@/lib/content-jobs/contracts";
import { ReviewShell } from "./review-shell";

export function CopyReview({
  value,
  disabled,
  onApprove,
}: {
  value: CopyOutput;
  disabled: boolean;
  onApprove: (value: CopyOutput) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  function updateSlide(
    index: number,
    patch: Partial<CopyOutput["slides"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      slides: current.slides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, ...patch } : slide,
      ),
    }));
  }
  return (
    <ReviewShell
      step="3 / 4 · 본문 카피"
      title="슬라이드별 내용을 다듬으세요"
      description="훅을 정하기 전에 본문의 논리와 흐름을 먼저 확정합니다. 각 장의 제목, 본문, 시각 방향을 수정할 수 있습니다."
    >
      <div className="grid gap-4">
        {draft.slides.map((slide, index) => (
          <article key={slide.id} className="grid gap-4 rounded-lg border p-6 max-md:p-4">
            <header className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{index + 1}장</h2>
              <span className="text-xs text-muted-foreground">{slide.id}</span>
            </header>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="역할">
                <Input
                  value={slide.role}
                  onChange={(event) => updateSlide(index, { role: event.target.value })}
                />
              </Field>
              <Field label="헤드라인">
                <Input
                  value={slide.headline}
                  onChange={(event) =>
                    updateSlide(index, { headline: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="본문">
              <Textarea
                className="min-h-24"
                value={slide.body}
                onChange={(event) => updateSlide(index, { body: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="시각 방향">
                <Textarea
                  value={slide.visualDirection}
                  onChange={(event) =>
                    updateSlide(index, { visualDirection: event.target.value })
                  }
                />
              </Field>
              <Field label="이전 장면과의 연결">
                <Textarea
                  value={slide.transitionFromPrevious}
                  onChange={(event) =>
                    updateSlide(index, {
                      transitionFromPrevious: event.target.value,
                    })
                  }
                />
              </Field>
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-end border-t pt-6">
        <Button
          className="h-11 px-5"
          disabled={disabled}
          onClick={() => void onApprove(draft)}
        >
          승인하고 훅 만들기
        </Button>
      </div>
    </ReviewShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
