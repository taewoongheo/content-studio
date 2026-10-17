"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TextColorRange, TextWeightRange, ElementStyle } from "@/domains/slideshow/editor/types";
import { selectedTextRange, setTextColor } from "@/domains/slideshow/editor/typography/ranges/text-colors";
import { setTextWeight, styledTextParts } from "@/domains/slideshow/editor/typography/ranges/text-weights";
import { editorFont, supportedFontWeight } from "@/domains/slideshow/editor/typography/fonts";

export function TextContentControl({ value, textColors, textWeights, baseColor, baseWeight, fontFamily, disabled, onChange, onColorsChange, onWeightsChange }: {
  value: string;
  textColors: TextColorRange[];
  textWeights: TextWeightRange[];
  baseColor: string;
  baseWeight: number;
  fontFamily: ElementStyle["fontFamily"];
  disabled: boolean;
  onChange: (value: string) => void;
  onColorsChange: (ranges: TextColorRange[]) => void;
  onWeightsChange: (ranges: TextWeightRange[]) => void;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number; value: string } | null>(null);
  const [weight, setWeight] = useState(700);
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
        <p className="text-xs text-muted-foreground">{selected ? `선택: ${value.slice(selected.start, selected.end)}` : "내용에서 글자를 선택해 색상과 굵기를 지정하세요."}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="color" aria-label="선택 텍스트 색상" value={color} disabled={disabled}
            className="h-8 w-10 p-1" onChange={(event) => setColor(event.target.value)} />
          <Button type="button" variant="outline" size="sm" disabled={disabled || !selected} onClick={() => apply(color)}>선택 색상 적용</Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !selected} onClick={() => apply(null)}>선택 색상 해제</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">선택 굵기
            <select aria-label="선택 텍스트 굵기" className="h-8 rounded-md border bg-background px-2" disabled={disabled}
              value={supportedFontWeight(fontFamily, weight)} onChange={(event) => setWeight(Number(event.target.value))}>
              {editorFont(fontFamily).weights.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <Button type="button" variant="outline" size="sm" disabled={disabled || !selected}
            onClick={() => selected && onWeightsChange(setTextWeight(value, textWeights, selected.start, selected.end, supportedFontWeight(fontFamily, weight)))}>선택 굵기 적용</Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || !selected}
            onClick={() => selected && onWeightsChange(setTextWeight(value, textWeights, selected.start, selected.end, null))}>선택 굵기 해제</Button>
        </div>
        {(textColors.length > 0 || textWeights.length > 0) && <>
          <div aria-label="부분 스타일 미리보기" className="whitespace-pre-wrap break-words rounded-md border bg-background p-2 text-sm"
            style={{ color: baseColor, fontWeight: supportedFontWeight(fontFamily, baseWeight), fontFamily: `var(${editorFont(fontFamily).variable}), sans-serif` }}>
            {styledTextParts(value, textColors, textWeights).map((part, index) => <span key={index}
              style={{ color: part.color, fontWeight: part.fontWeight === undefined ? undefined : supportedFontWeight(fontFamily, part.fontWeight) }}>{part.text}</span>)}
          </div>
        </>}
        {textColors.length > 0 && <>
          <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={disabled}
            onClick={() => onColorsChange([])}>부분 색상 모두 해제</Button>
        </>}
        {textWeights.length > 0 && <Button type="button" variant="ghost" size="sm" className="justify-self-start" disabled={disabled}
          onClick={() => onWeightsChange([])}>부분 굵기 모두 해제</Button>}
      </div>
    </div>
  );
}
