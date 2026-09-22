"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HookOutput } from "@/lib/content-jobs/contracts";
import { ReviewShell } from "./review-shell";

export function HookReview({
  value,
  disabled,
  onApprove,
}: {
  value: HookOutput;
  disabled: boolean;
  onApprove: (value: HookOutput, selectedId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value));
  const [selectedId, setSelectedId] = useState(value.hooks[0]?.id ?? "");
  function updateHook(
    index: number,
    patch: Partial<HookOutput["hooks"][number]>,
  ) {
    setDraft((current) => ({
      ...current,
      hooks: current.hooks.map((hook, hookIndex) =>
        hookIndex === index ? { ...hook, ...patch } : hook,
      ),
    }));
  }
  return (
    <ReviewShell
      step="4 / 4 · 훅"
      title="첫 장에 사용할 훅을 고르세요"
      description="모든 후보는 승인한 본문으로 뒷받침되어야 합니다. 문구와 패턴을 수정한 뒤 하나를 선택하세요."
    >
      <div className="grid gap-4">
        {draft.hooks.map((hook, index) => (
          <label
            key={hook.id}
            className="grid cursor-pointer gap-4 rounded-lg border p-6 has-[:checked]:border-foreground has-[:checked]:ring-1 has-[:checked]:ring-foreground max-md:p-4"
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="hook"
                value={hook.id}
                checked={selectedId === hook.id}
                onChange={() => setSelectedId(hook.id)}
                className="size-4"
              />
              <span className="font-semibold">후보 {index + 1}</span>
            </span>
            <Field label="훅 문구">
              <Textarea
                className="min-h-20 text-base font-medium"
                value={hook.text}
                onChange={(event) => updateHook(index, { text: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
              <Field label="패턴">
                <Input
                  value={hook.pattern}
                  onChange={(event) =>
                    updateHook(index, { pattern: event.target.value })
                  }
                />
              </Field>
              <Field label="강조 각도">
                <Input
                  value={hook.angle}
                  onChange={(event) =>
                    updateHook(index, { angle: event.target.value })
                  }
                />
              </Field>
            </div>
            <p className="text-sm text-muted-foreground">
              뒷받침 슬라이드: {hook.supportingSlideIds.join(", ")}
            </p>
          </label>
        ))}
      </div>
      {draft.warnings.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          {draft.warnings.join(" ")}
        </div>
      )}
      <div className="flex justify-end border-t pt-6">
        <Button
          className="h-11 px-5"
          disabled={disabled || !selectedId}
          onClick={() => void onApprove(draft, selectedId)}
        >
          훅 선택하고 완료
        </Button>
      </div>
    </ReviewShell>
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
