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

export function RegenerateControl({
  disabled,
  onRegenerate,
}: {
  disabled: boolean;
  onRegenerate: (guidance: string) => Promise<void>;
}) {
  const [guidance, setGuidance] = useState("");
  return (
    <section className="grid gap-3 rounded-lg border p-5" aria-label="제안 재생성">
      <Label htmlFor="regeneration-guidance">수정 요청</Label>
      <Textarea
        id="regeneration-guidance"
        value={guidance}
        onChange={(event) => setGuidance(event.target.value)}
        placeholder="예: 제품 홍보보다 사용자의 실제 문제에 초점을 맞춰 주세요."
        maxLength={2000}
        disabled={disabled}
      />
      <p className="text-xs leading-5 text-muted-foreground">
        현재 편집 내용과 수정 요청을 바탕으로 이 단계의 제안을 다시 만듭니다.
      </p>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !guidance.trim()}
          onClick={() => void onRegenerate(guidance.trim())}
        >
          재생성
        </Button>
      </div>
    </section>
  );
}
