"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import Image from "next/image";
import { ImageUploadField } from "@/components/media/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { EditorCommand, ElementDefinition, ElementFrame, ElementStyle, PlacedElement } from "@/lib/content-jobs/editor/types";
import { commandsFromDraft, makeElementDraft, validElementDraft, type VisualTarget } from "./element-draft";
import { useAutosave } from "./use-autosave";

type Props = {
  ref?: Ref<ElementInspectorHandle>;
  element: ElementDefinition;
  placement: PlacedElement;
  slideId: string;
  selectedSlideIds: string[];
  visualTargets: VisualTarget[];
  jobId: string;
  currentImage: ContentJobSnapshot["assets"][number] | null;
  disabled: boolean;
  onSave: (commands: EditorCommand[]) => Promise<boolean>;
  onUploadImage: (file: File) => Promise<boolean>;
};

export type ElementInspectorHandle = { flushPending: () => Promise<boolean> };

export function ElementInspector({ ref, element, placement, slideId, selectedSlideIds, visualTargets, jobId, currentImage, disabled, onSave, onUploadImage }: Props) {
  const [draft, setDraft] = useState(() => makeElementDraft(element, placement));
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
          <div className="grid gap-3">
            {currentImage && <div className="grid gap-1.5 text-sm">
              <span className="font-medium">현재 이미지</span>
              <div className="relative h-40 overflow-hidden rounded-lg border bg-muted/30">
                <Image src={`/api/content-jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(currentImage.id)}`}
                  alt={currentImage.name} fill unoptimized sizes="300px" className="object-contain" />
              </div>
              <span className="truncate text-xs text-muted-foreground">{currentImage.name}</span>
            </div>}
            <ImageUploadField id={`editor-image-${placement.id}`} label="이미지 업로드" file={uploadedFile}
              disabled={disabled || uploading} onFileChange={(file) => {
                if (!file) return;
                setUploading(true);
                void onUploadImage(file).then((saved) => {
                  if (saved) setUploadedFile(file);
                }).finally(() => setUploading(false));
              }} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 border-t pt-5">
        <div className="text-sm font-semibold">위치·스타일</div>
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

    </div>
  );
}

function NumberField({ label, value, onChange, disabled = false }: { label: string; value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <label className="grid gap-1.5 text-xs font-medium">{label}<Input type="number" step="1" value={Number(value.toFixed(1))} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
