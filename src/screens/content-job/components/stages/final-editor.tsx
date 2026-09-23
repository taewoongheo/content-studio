"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  AcceptedHookOutput,
  CopyOutput,
} from "@/lib/content-jobs/structured-output/contracts";
import type { SlideshowStructure } from "@/lib/content-jobs/domain/types";
import { ReviewShell } from "../review-shell";
import { structureRoleLabel } from "./structure-label";

export function FinalEditor({
  copy,
  hooks,
  structure,
  disabled,
  onSave,
}: {
  copy: CopyOutput;
  hooks: AcceptedHookOutput;
  structure: SlideshowStructure;
  disabled: boolean;
  onSave: (
    copy: CopyOutput,
    hooks: AcceptedHookOutput,
    selectedId: string,
  ) => Promise<void>;
}) {
  const [copyDraft, setCopyDraft] = useState(() => structuredClone(copy));
  const [hookDraft, setHookDraft] = useState(() => structuredClone(hooks));
  const selectedIndex = hookDraft.hooks.findIndex(
    (hook) => hook.id === hookDraft.selectedHookId,
  );
  const selectedHook = hookDraft.hooks[selectedIndex];

  return (
    <ReviewShell
      step="완료 · 최종 편집기"
      title="콘텐츠 기획이 완성됐습니다"
      description="선택한 훅과 슬라이드 카피를 한 화면에서 마지막으로 다듬을 수 있습니다. 저장하면 현재 작업의 최종본이 갱신됩니다."
    >
      <div className="flex items-center gap-2 rounded-lg bg-surface-subtle p-4 text-sm font-medium">
        <Check className="size-4" aria-hidden="true" />
        레퍼런스 분석, 전략, 본문, 훅 검토 완료
      </div>
      {selectedHook && (
        <section className="grid gap-3 rounded-lg border p-6 max-md:p-4">
          <h2 className="font-semibold">선택한 훅</h2>
          <Textarea
            className="min-h-24 text-lg font-semibold"
            value={selectedHook.text}
            onChange={(event) =>
              setHookDraft((current) => ({
                ...current,
                hooks: current.hooks.map((hook, index) =>
                  index === selectedIndex
                    ? { ...hook, text: event.target.value }
                    : hook,
                ),
              }))
            }
          />
        </section>
      )}
      <div className="grid gap-4">
        {copyDraft.slides.map((slide, index) => (
          <article key={slide.id} className="grid gap-4 rounded-lg border p-6 max-md:p-4">
            <h2 className="font-semibold">{index + 1}장</h2>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="역할">
                <Input
                  value={structure === "repeating" ? structureRoleLabel(slide.role) : slide.role}
                  readOnly={structure === "repeating"}
                  onChange={(event) => {
                    if (structure === "repeating") return;
                    setCopyDraft((current) => ({
                      ...current,
                      slides: current.slides.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, role: event.target.value }
                          : item,
                      ),
                    }));
                  }}
                />
              </Field>
              <Field label="헤드라인">
                <Input
                  value={structure === "repeating" && index === 0 && selectedHook
                    ? selectedHook.text
                    : slide.headline}
                  readOnly={structure === "repeating" && index === 0}
                  onChange={(event) => {
                    if (structure === "repeating" && index === 0) return;
                    setCopyDraft((current) => ({
                      ...current,
                      slides: current.slides.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, headline: event.target.value }
                          : item,
                      ),
                    }));
                  }}
                />
              </Field>
            </div>
            <Field label="본문">
              <Textarea
                className="min-h-24"
                value={slide.body}
                onChange={(event) =>
                  setCopyDraft((current) => ({
                    ...current,
                    slides: current.slides.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, body: event.target.value }
                        : item,
                    ),
                  }))
                }
              />
            </Field>
            <Field label="시각 방향">
              <Textarea
                value={slide.visualDirection}
                onChange={(event) =>
                  setCopyDraft((current) => ({
                    ...current,
                    slides: current.slides.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, visualDirection: event.target.value }
                        : item,
                    ),
                  }))
                }
              />
            </Field>
          </article>
        ))}
      </div>
      <div className="flex justify-end border-t pt-6">
        <Button
          className="h-11 px-5"
          disabled={disabled || !selectedHook}
          onClick={() =>
            void onSave(copyDraft, hookDraft, hookDraft.selectedHookId)
          }
        >
          최종 수정 저장
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
