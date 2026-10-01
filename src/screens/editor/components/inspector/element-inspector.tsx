"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import Image from "next/image";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { ImageUploadField } from "@/components/media/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { EditorCommand, ElementDefinition, ElementFrame, ElementStyle, PlacedElement } from "@/lib/content-jobs/editor/types";
import { commandsFromDraft, draftWithFontSize, frameWithLockedDimension, makeElementDraft, validElementDraft, type VisualTarget } from "./element-draft";
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
  imageAspectRatioLocked: boolean;
  disabled: boolean;
  onSave: (commands: EditorCommand[]) => Promise<boolean>;
  onUploadImage: (file: File) => Promise<boolean>;
  onImageAspectRatioLockedChange: (locked: boolean) => void;
};

export type ElementInspectorHandle = { flushPending: () => Promise<boolean> };

const textAlignmentOptions = [
  { value: "left", label: "왼쪽 정렬", Icon: AlignLeft },
  { value: "center", label: "가운데 정렬", Icon: AlignCenter },
  { value: "right", label: "오른쪽 정렬", Icon: AlignRight },
] as const;

export function ElementInspector({ ref, element, placement, slideId, selectedSlideIds, visualTargets, jobId,
  currentImage, imageAspectRatioLocked, disabled, onSave, onUploadImage, onImageAspectRatioLockedChange }: Props) {
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
    setDraft((current) => ({ ...current, frame: element.kind === "image" && imageAspectRatioLocked &&
      (key === "width" || key === "height")
      ? frameWithLockedDimension(current.frame, key, percent / 100)
      : { ...current.frame, [key]: percent / 100 } }));
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
          <NumberField label={element.kind === "text" ? "최대 너비 (%)" : "너비 (%)"}
            value={draft.frame.width * 100} onChange={(value) => updateFrame("width", value)} />
          {element.kind !== "text" &&
            <NumberField label="높이 (%)" value={draft.frame.height * 100} onChange={(value) => updateFrame("height", value)} />}
          {element.kind === "image" && <label className="col-span-2 flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={imageAspectRatioLocked}
              onChange={(event) => onImageAspectRatioLockedChange(event.target.checked)} />
            너비·높이 비율 유지
          </label>}
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
              <NumberField label="글자 크기" value={draft.style.fontSize}
                onChange={(value) => setDraft((current) => draftWithFontSize(current, value))} />
              <NumberField label="줄 높이" value={draft.style.lineHeight} step={0.1} min={0.8} max={3}
                onChange={(value) => updateStyle("lineHeight", value)} />
              <NumberField label="글자 굵기" value={draft.style.fontWeight} onChange={(value) => updateStyle("fontWeight", value)} />
              <label className="grid gap-1.5 text-xs font-medium">글꼴 계열
                <select className="h-10 rounded-md border bg-background px-2 text-sm" value={draft.style.fontFamily} onChange={(event) => updateStyle("fontFamily", event.target.value as ElementStyle["fontFamily"])}>
                  <option value="sans-serif">고딕</option><option value="serif">명조</option><option value="monospace">고정폭</option>
                </select>
              </label>
              <div className="grid gap-1.5 text-xs font-medium">
                <span>정렬</span>
                <div className="grid h-10 grid-cols-3 overflow-hidden rounded-md border bg-background" role="group" aria-label="텍스트 정렬">
                  {textAlignmentOptions.map(({ value, label, Icon }) => (
                    <button key={value} type="button" aria-label={label} aria-pressed={draft.style.textAlign === value}
                      title={label} onClick={() => updateStyle("textAlign", value)}
                      className={`grid place-items-center border-r last:border-r-0 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-foreground ${draft.style.textAlign === value ? "bg-foreground text-background" : "hover:bg-muted"}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
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

function NumberField({ label, value, onChange, disabled = false, step = 1, min, max }: { label: string; value: number;
  onChange: (value: number) => void; disabled?: boolean; step?: number; min?: number; max?: number }) {
  return <label className="grid gap-1.5 text-xs font-medium">{label}<Input type="number" step={step} min={min} max={max}
    value={Number(value.toFixed(1))} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
