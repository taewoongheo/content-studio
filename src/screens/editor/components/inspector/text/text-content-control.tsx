"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextColorRange } from "@/lib/content-jobs/editor/types";
import { selectedTextRange, setTextColor, textColorParts } from "@/lib/content-jobs/editor/typography/text-colors";

export function TextContentControl({ value, textColors, baseColor, disabled, onChange, onColorsChange }: {
  value: string;
  textColors: TextColorRange[];
  baseColor: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onColorsChange: (ranges: TextColorRange[]) => void;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number; value: string } | null>(null);
  const [color, setColor] = useState("#DC0000");
  const selected = selection?.value === value && selection.end > selection.start ? selection : null;
  function apply(color: string | null) {
    if (selected) onColorsChange(setTextColor(value, textColors, selected.start, selected.end, color));
  }
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5 text-sm"><span className="font-medium">내용</span>
        <Textarea aria-label="내용" value={value} disabled={disabled} onChange={(event) => { setSelection(null); onChange(event.target.value); }}
          onSelect={(event) => {
            const input = event.currentTarget;
            setSelection({ ...selectedTextRange(value, input.selectionStart, input.selectionEnd), value });
          }} />
      </label>
      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">{selected ? `선택: ${value.slice(selected.start, selected.end)}` : "내용에서 글자를 선택해 부분 색상을 지정하세요."}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="color" aria-label="선택 텍스트 색상" value={color} disabled={disabled}
            className="h-8 w-10 p-1" onChange={(event) => setColor(event.target.value)} />
          <Button type="button" variant="outline" size="sm" disabled={disabled || !selected} onClick={() => apply(color)}>선택 색상 적용</Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !selected} onClick={() => apply(null)}>선택 색상 해제</Button>
        </div>
        {textColors.length > 0 && <>
          <div aria-label="부분 색상 미리보기" className="whitespace-pre-wrap break-words rounded-md border bg-background p-2 text-sm" style={{ color: baseColor }}>
            {textColorParts(value, textColors).map((part, index) => <span key={index} style={{ color: part.color }}>{part.text}</span>)}
          </div>
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={disabled}
            onClick={() => onColorsChange([])}>부분 색상 모두 해제</Button>
        </>}
      </div>
    </div>
  );
}
