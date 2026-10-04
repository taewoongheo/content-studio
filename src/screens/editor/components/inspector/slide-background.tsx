"use client";

import { useImperativeHandle, useState, type Ref } from "react";

import { useAutosave } from "./use-autosave";

export type SlideBackgroundHandle = { flushPending: () => Promise<boolean> };

export function SlideBackground({ ref, color, disabled, onSave }: {
  ref?: Ref<SlideBackgroundHandle>;
  color: string;
  disabled: boolean;
  onSave: (color: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState({ source: color, value: color });
  if (draft.source !== color) setDraft({ source: color, value: color });

  const { flushPending, failed } = useAutosave(draft.value === color ? [] : [draft.value], !disabled,
    (colors) => onSave(colors[0]));
  useImperativeHandle(ref, () => ({ flushPending }), [flushPending]);

  return (
    <div className="grid min-w-0 gap-5 p-4">
      <div className="text-sm font-semibold">배경</div>
      {failed && <p role="alert" className="text-xs text-destructive">배경색을 반영하지 못했습니다.</p>}
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
