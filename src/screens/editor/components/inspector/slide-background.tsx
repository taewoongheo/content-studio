"use client";

import { visualScopeLabel } from "../element-scope";

export function SlideBackground({ color, disabled, selectedCount, totalCount, onSave }: {
  color: string;
  disabled: boolean;
  selectedCount: number;
  totalCount: number;
  onSave: (color: string) => Promise<boolean>;
}) {
  return (
    <div className="grid min-w-0 gap-5 p-4">
      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">배경</span><span className="text-xs text-muted-foreground">{visualScopeLabel(selectedCount, totalCount)}에 적용</span></div>
      <label className="grid gap-2 text-sm font-medium">
        배경색
        <span className="flex items-center gap-3 rounded-lg border bg-background p-3">
          <input type="color" value={color} disabled={disabled} onChange={(event) => void onSave(event.target.value)} aria-label="슬라이드 배경색" className="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1" />
          <span className="font-mono text-xs font-normal text-muted-foreground">{color.toUpperCase()}</span>
        </span>
      </label>
    </div>
  );
}
