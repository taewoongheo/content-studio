"use client";

import { useEffect, useRef, useState } from "react";

export function SlideBackground({ color, disabled, onSave }: {
  color: string;
  disabled: boolean;
  onSave: (color: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({ source: color, value: color });
  const saveRef = useRef(onSave);
  if (draft.source !== color) setDraft({ source: color, value: color });

  useEffect(() => { saveRef.current = onSave; }, [onSave]);
  useEffect(() => {
    if (disabled || draft.value === color) return;
    const timer = window.setTimeout(() => void saveRef.current(draft.value), 350);
    return () => window.clearTimeout(timer);
  }, [color, disabled, draft.value]);

  return (
    <div className="grid min-w-0 gap-5 p-4">
      <div className="text-sm font-semibold">배경</div>
      <label className="grid gap-2 text-sm font-medium">
        배경색
        <span className="flex items-center gap-3 rounded-lg border bg-background p-3">
          <input type="color" value={draft.value} disabled={disabled} onChange={(event) => setDraft({ source: color, value: event.target.value })} aria-label="슬라이드 배경색" className="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1" />
          <span className="font-mono text-xs font-normal text-muted-foreground">{draft.value.toUpperCase()}</span>
        </span>
      </label>
    </div>
  );
}
