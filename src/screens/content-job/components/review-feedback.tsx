"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReviewNotes({ items }: { items: string[] }) {
  return (
    <section className="grid gap-2 rounded-lg border bg-surface-subtle p-5" aria-label="확인 필요">
      <h2 className="text-sm font-semibold">확인 필요</h2>
      {items.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
          {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">표시된 항목이 없습니다.</p>
      )}
    </section>
  );
}

export function ReviewCompletion({
  scope,
  approveLabel,
  disabled,
  approveDisabled,
  onRegenerate,
  onApprove,
}: {
  scope: string;
  approveLabel: string;
  disabled: boolean;
  approveDisabled: boolean;
  onRegenerate: (guidance: string) => Promise<void>;
  onApprove: () => Promise<void>;
}) {
  const [guidance, setGuidance] = useState("");
  return (
    <section className="grid gap-5 border-t pt-6" aria-label={`${scope} 검토 작업`}>
      <div className="grid gap-2">
        <Label htmlFor="regeneration-guidance">이 단계 전체에 대한 수정 요청</Label>
        <Textarea
          id="regeneration-guidance"
          name="regenerationGuidance"
          aria-describedby="regeneration-scope"
          value={guidance}
          onChange={(event) => setGuidance(event.target.value)}
          placeholder="예: 제품 홍보보다 사용자의 실제 문제에 초점을 맞춰 주세요."
          maxLength={2000}
          disabled={disabled}
        />
        <p id="regeneration-scope" className="text-xs leading-5 text-muted-foreground">
          재생성하면 {scope}를 새로 제안받습니다. 현재 편집 내용도 함께 반영합니다.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <Button
          type="button"
          variant="outline"
          className="h-11 px-5"
          disabled={disabled || !guidance.trim()}
          onClick={() => void onRegenerate(guidance.trim())}
        >
          재생성
        </Button>
        <Button
          type="button"
          className="h-11 px-5"
          disabled={disabled || approveDisabled}
          onClick={() => void onApprove()}
        >
          {approveLabel}
        </Button>
      </div>
    </section>
  );
}
