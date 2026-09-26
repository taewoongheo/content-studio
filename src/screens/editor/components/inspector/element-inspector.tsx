"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DuplicationScope, EditorCommand, ElementDefinition, ElementFrame, ElementStyle, PlacedElement } from "@/lib/content-jobs/editor/types";
import { commandsFromDraft, makeElementDraft, validElementDraft, type VisualTarget } from "./element-draft";
import { visualScopeLabel } from "../element-scope";
import { useAutosave } from "./use-autosave";

type Props = {
  ref?: Ref<ElementInspectorHandle>;
  element: ElementDefinition;
  placement: PlacedElement;
  slideId: string;
  selectedSlideIds: string[];
  sharedCount: number;
  visualTargets: VisualTarget[];
  disabled: boolean;
  onSave: (commands: EditorCommand[]) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onDuplicate: (scope: DuplicationScope) => Promise<void>;
  onUploadImage: (file: File) => Promise<void>;
};

export type ElementInspectorHandle = { flushPending: () => Promise<boolean> };

export function ElementInspector({ ref, element, placement, slideId, selectedSlideIds, sharedCount, visualTargets, disabled, onSave, onDelete, onDuplicate, onUploadImage }: Props) {
  const [duplicateScope, setDuplicateScope] = useState<DuplicationScope>("current");
  const [draft, setDraft] = useState(() => makeElementDraft(element, placement));
  const previous = useRef({ element, placement });
  const commands = commandsFromDraft(draft, element, placement, slideId, visualTargets, selectedSlideIds);
  const valid = validElementDraft(draft);
  const { saving, failed } = useAutosave(commands, !disabled && valid, onSave);
  const isShape = element.kind === "rectangle" || element.kind === "circle" || element.kind === "triangle";

  useEffect(() => {
    const prior = previous.current;
    if (prior.element === element && prior.placement === placement) return;
    const hadLocalChanges = commandsFromDraft(draft, prior.element, prior.placement, slideId, visualTargets, selectedSlideIds).length > 0;
    previous.current = { element, placement };
    if (!hadLocalChanges) setDraft(makeElementDraft(element, placement));
  }, [element, placement, draft, slideId, visualTargets, selectedSlideIds]);

  useImperativeHandle(ref, () => ({
    flushPending: async () => commands.length === 0 || (valid && await onSave(commands)),
  }), [commands, valid, onSave]);

  function updateFrame(key: keyof ElementFrame, percent: number) {
    setDraft((current) => ({ ...current, frame: { ...current.frame, [key]: percent / 100 } }));
  }

  function updateStyle<Key extends keyof ElementStyle>(key: Key, value: ElementStyle[Key]) {
    setDraft((current) => ({ ...current, style: { ...current.style, [key]: value } }));
  }

  async function duplicate() {
    if (commands.length > 0 && valid && !(await onSave(commands))) return;
    await onDuplicate(duplicateScope);
  }

  return (
    <div className="grid min-w-0 gap-5 p-4">
      {(!valid || failed) && <p role="alert" className="text-xs text-destructive">
        {!valid ? "이름·역할·위치·크기를 확인해 주세요." : "자동 저장에 실패했습니다. 값을 수정해 다시 시도해 주세요."}
      </p>}
      {saving && <span role="status" className="sr-only">저장 중</span>}

      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm"><span className="font-medium">이름</span><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="grid gap-1.5 text-sm"><span className="font-medium">역할·의미</span><Textarea value={draft.role} onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))} /></label>
        {element.kind === "text" ? (
          <label className="grid gap-1.5 text-sm"><span className="font-medium">내용</span><Textarea value={draft.value} onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))} /></label>
        ) : element.kind === "image" ? (
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">이 슬라이드의 이미지</span>
            <Input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUploadImage(file);
              event.target.value = "";
            }} />
          </label>
        ) : null}
      </div>

      <div className="grid gap-3 border-t pt-5">
        <div className="flex items-baseline justify-between gap-2 text-sm"><span className="font-semibold">위치·스타일</span><span className="text-xs text-muted-foreground">{visualScopeLabel(selectedSlideIds.length, sharedCount)}에 적용</span></div>
        <fieldset disabled={disabled} className="grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">
          <NumberField label="X (%)" value={draft.frame.x * 100} onChange={(value) => updateFrame("x", value)} />
          <NumberField label="Y (%)" value={draft.frame.y * 100} onChange={(value) => updateFrame("y", value)} />
          <NumberField label="너비 (%)" value={draft.frame.width * 100} onChange={(value) => updateFrame("width", value)} />
          <NumberField label="높이 (%)" value={draft.frame.height * 100} onChange={(value) => updateFrame("height", value)} />
        </fieldset>
        <fieldset disabled={disabled} className="grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">
          {element.kind === "text" && (
            <label className="grid gap-1.5 text-xs font-medium">글자색<Input type="color" className="h-10 p-1" value={draft.style.color} onChange={(event) => updateStyle("color", event.target.value)} /></label>
          )}
          <label className="grid gap-1.5 text-xs font-medium">{isShape ? "채우기 색" : "배경색"}
            <Input type="color" className="h-10 p-1" value={draft.style.backgroundColor === "transparent" ? "#FFFFFF" : draft.style.backgroundColor} onChange={(event) => updateStyle("backgroundColor", event.target.value)} disabled={draft.style.backgroundColor === "transparent"} />
          </label>
          {!isShape && <label className="col-span-2 flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={draft.style.backgroundColor === "transparent"} onChange={(event) => updateStyle("backgroundColor", event.target.checked ? "transparent" : "#FFFFFF")} />투명 배경</label>}
          {element.kind === "text" && (
            <>
              <NumberField label="글자 크기" value={draft.style.fontSize} onChange={(value) => updateStyle("fontSize", value)} />
              <NumberField label="글자 굵기" value={draft.style.fontWeight} onChange={(value) => updateStyle("fontWeight", value)} />
              <label className="grid gap-1.5 text-xs font-medium">글꼴 계열
                <select className="h-10 rounded-md border bg-background px-2 text-sm" value={draft.style.fontFamily} onChange={(event) => updateStyle("fontFamily", event.target.value as ElementStyle["fontFamily"])}>
                  <option value="sans-serif">고딕</option><option value="serif">명조</option><option value="monospace">고정폭</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium">정렬
                <select className="h-10 rounded-md border bg-background px-2 text-sm" value={draft.style.textAlign} onChange={(event) => updateStyle("textAlign", event.target.value as ElementStyle["textAlign"])}>
                  <option value="left">왼쪽</option><option value="center">가운데</option><option value="right">오른쪽</option>
                </select>
              </label>
            </>
          )}
          {element.kind === "image" && <label className="grid gap-1.5 text-xs font-medium">이미지 맞춤
            <select className="h-10 rounded-md border bg-background px-2 text-sm" value={draft.style.imageFit} onChange={(event) => updateStyle("imageFit", event.target.value as ElementStyle["imageFit"])}>
              <option value="cover">영역 채우기</option><option value="contain">전체 보이기</option>
            </select>
          </label>}
          {(element.kind === "text" || element.kind === "image" || element.kind === "rectangle") &&
            <NumberField label="모서리" value={draft.style.borderRadius} onChange={(value) => updateStyle("borderRadius", value)} />}
        </fieldset>
      </div>

      <div className="grid gap-3 border-t pt-5">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={duplicateScope === "all"} disabled={disabled} onChange={(event) => setDuplicateScope(event.target.checked ? "all" : "current")} />
          같은 Element가 있는 모든 슬라이드에 복제{sharedCount > 1 ? ` (${sharedCount}장)` : ""}
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="sm" disabled={disabled || !valid} onClick={() => void duplicate()}><Copy aria-hidden="true" /> 복제</Button>
          <Button variant="destructive" size="icon-sm" disabled={disabled} onClick={() => void onDelete()} aria-label="현재 슬라이드에서 Element 제거"><Trash2 aria-hidden="true" /></Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="grid gap-1.5 text-xs font-medium">{label}<Input type="number" step="1" value={Number(value.toFixed(1))} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
