"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ReferenceAnalysisOutput } from "@/lib/content-jobs/contracts";
import { ReviewShell } from "./review-shell";

export function ReferenceReview({
  value,
  disabled,
  onApprove,
}: {
  value: ReferenceAnalysisOutput;
  disabled: boolean;
  onApprove: (value: ReferenceAnalysisOutput) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  return (
    <ReviewShell
      step="1 / 4 · 레퍼런스 분석"
      title="가져올 패턴을 확인하세요"
      description="원문을 복사하는 것이 아니라 구조와 표현 규칙을 추출한 결과입니다. 원하는 방향과 다르면 직접 수정하세요."
    >
      <div className="grid gap-5 rounded-lg border p-6 max-md:p-4">
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <Field label="원본 언어">
            <Input
              value={draft.sourceLanguage}
              onChange={(event) =>
                setDraft({ ...draft, sourceLanguage: event.target.value })
              }
            />
          </Field>
          <Field label="결과 언어">
            <Input
              value={draft.outputLanguage}
              onChange={(event) =>
                setDraft({ ...draft, outputLanguage: event.target.value })
              }
            />
          </Field>
        </div>
        <TextField
          label="시각 언어"
          value={draft.visualLanguage.summary}
          onChange={(summary) =>
            setDraft({
              ...draft,
              visualLanguage: { ...draft.visualLanguage, summary },
            })
          }
        />
        <TextField
          label="문체"
          value={draft.writingStyle.summary}
          onChange={(summary) =>
            setDraft({
              ...draft,
              writingStyle: { ...draft.writingStyle, summary },
            })
          }
        />
        <TextField
          label="텍스트 밀도"
          value={draft.textDensity.summary}
          onChange={(summary) =>
            setDraft({
              ...draft,
              textDensity: { ...draft.textDensity, summary },
            })
          }
        />
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          <TextField
            label="원문 훅"
            value={draft.hook.originalText}
            onChange={(originalText) =>
              setDraft({ ...draft, hook: { ...draft.hook, originalText } })
            }
          />
          <TextField
            label="훅 패턴"
            value={draft.hook.pattern}
            onChange={(pattern) =>
              setDraft({ ...draft, hook: { ...draft.hook, pattern } })
            }
          />
        </div>
      </div>
      <div className="grid gap-3">
        <h2 className="text-base font-semibold">슬라이드 전개</h2>
        {draft.slides.map((slide, index) => (
          <div key={slide.imageId} className="grid gap-4 rounded-lg border p-5">
            <p className="text-sm font-medium">
              {index + 1}. {slide.imageId}
            </p>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <TextField
                label="역할"
                value={slide.role}
                onChange={(role) =>
                  setDraft((current) => ({
                    ...current,
                    slides: current.slides.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, role } : item,
                    ),
                  }))
                }
              />
              <TextField
                label="이전 장면과의 연결"
                value={slide.transitionFromPrevious}
                onChange={(transitionFromPrevious) =>
                  setDraft((current) => ({
                    ...current,
                    slides: current.slides.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, transitionFromPrevious }
                        : item,
                    ),
                  }))
                }
              />
            </div>
          </div>
        ))}
      </div>
      <TextField
        label="불확실한 부분"
        value={draft.uncertainties.join("\n")}
        onChange={(value) =>
          setDraft({
            ...draft,
            uncertainties: value.split("\n").filter(Boolean),
          })
        }
      />
      <div className="flex justify-end border-t pt-6">
        <Button
          className="h-11 px-5"
          disabled={disabled}
          onClick={() => void onApprove(draft)}
        >
          승인하고 전략 만들기
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

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}
