"use client";

import { useRef, useState, type DragEvent, type PointerEvent } from "react";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/document";
import { CANVAS_SAFE_AREA, moveOrResizeFrame, type DragMode } from "./frame/geometry";
import { SlideArtwork } from "./slide-artwork";

type Gesture = { pointerId: number; placementId: string; mode: DragMode; startX: number; startY: number;
  canvasWidth: number; canvasHeight: number; frame: ElementFrame; lockAspectRatio: boolean };
const handles = ["nw", "ne", "sw", "se"] as const;
const handlePositions = { nw: "-left-1.5 -top-1.5 cursor-nwse-resize", ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize", se: "-bottom-1.5 -right-1.5 cursor-nwse-resize" } as const;
const acceptedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function droppedImage(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.files).find((file) => acceptedImageTypes.has(file.type)) ?? null;
}

function includesImage(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.items).some((item) => item.kind === "file" && acceptedImageTypes.has(item.type));
}

export function SlideCanvas({
  document,
  slide,
  jobId,
  selectedPlacementId,
  selectionAppliesToAll,
  disabled,
  showGuides,
  lockImageAspectRatio,
  onSelect,
  onSelectBackground,
  onFrameChange,
  onDropImage,
}: {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  selectedPlacementId: string | null;
  selectionAppliesToAll: boolean;
  disabled: boolean;
  showGuides: boolean;
  lockImageAspectRatio: boolean;
  onSelect: (placementId: string) => void;
  onSelectBackground: () => void;
  onFrameChange: (placementId: string, frame: ElementFrame) => Promise<boolean>;
  onDropImage: (file: File, center: { x: number; y: number }) => Promise<boolean>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ placementId: string; frame: ElementFrame } | null>(null);
  const [imageDragActive, setImageDragActive] = useState(false);
  const elements = new Map(document.elements.map((element) => [element.id, element]));
  const selectionRing = selectionAppliesToAll ? "ring-sky-400" : "ring-primary";
  const selectionHandle = selectionAppliesToAll ? "border-sky-400 bg-sky-50" : "border-primary bg-background";

  function beginGesture(event: PointerEvent<HTMLButtonElement>, placementId: string, frame: ElementFrame, mode: DragMode,
    lockAspectRatio = false) {
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    if (selectedPlacementId !== placementId) {
      onSelect(placementId);
      return;
    }
    if (disabled) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const renderedBounds = event.currentTarget.parentElement?.getBoundingClientRect();
    const renderedFrame = renderedBounds ? {
      x: (renderedBounds.left - bounds.left) / bounds.width,
      y: (renderedBounds.top - bounds.top) / bounds.height,
      width: renderedBounds.width / bounds.width,
      height: renderedBounds.height / bounds.height,
    } : frame;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { pointerId: event.pointerId, placementId, mode, startX: event.clientX, startY: event.clientY,
      canvasWidth: bounds.width, canvasHeight: bounds.height, frame: renderedFrame, lockAspectRatio };
  }

  function frameAtPointer(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return null;
    const frame = moveOrResizeFrame(active.frame, active.mode,
      (event.clientX - active.startX) / active.canvasWidth, (event.clientY - active.startY) / active.canvasHeight,
      showGuides, active.lockAspectRatio);
    return { placementId: active.placementId, frame };
  }

  function moveGesture(event: PointerEvent<HTMLButtonElement>) {
    const next = frameAtPointer(event);
    if (next) setPreview(next);
  }

  async function finishGesture(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    const next = frameAtPointer(event);
    if (!active || !next) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (Object.keys(next.frame).every((key) => next.frame[key as keyof ElementFrame] === active.frame[key as keyof ElementFrame])) {
      setPreview(null);
      return;
    }
    setPreview(next);
    try {
      await onFrameChange(next.placementId, next.frame);
    } finally {
      setPreview(null);
    }
  }

  function cancelGesture(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setPreview(null);
  }

  function dragImageOver(event: DragEvent<HTMLDivElement>) {
    if (disabled || !includesImage(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setImageDragActive(true);
  }

  function leaveImageDrag(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setImageDragActive(false);
  }

  function dropImageOnCanvas(event: DragEvent<HTMLDivElement>) {
    const file = droppedImage(event.dataTransfer);
    setImageDragActive(false);
    if (disabled || !file) return;
    event.preventDefault();
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const center = {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
    void onDropImage(file, center);
  }

  return (
    <div
      ref={canvasRef}
      className={`relative mx-auto h-full w-auto max-h-full max-w-full overflow-visible border bg-white shadow-sm ${selectedPlacementId === BACKGROUND_PLACEMENT_ID ? `ring-2 ${selectionRing} ring-offset-2` : ""}`}
      style={{ aspectRatio: document.aspectRatio.replace(":", "/"), containerType: "inline-size" }}
      aria-label={`${slide.role} 슬라이드 미리보기`}
      onDragOver={dragImageOver}
      onDragLeave={leaveImageDrag}
      onDrop={dropImageOnCanvas}
    >
      <SlideArtwork
        document={document}
        slide={slide}
        jobId={jobId}
        framePreview={preview}
        className="absolute inset-0 size-full"
        aria-hidden="true"
      />
      <button type="button" className="absolute inset-0 z-20 size-full cursor-default border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-foreground" onClick={onSelectBackground} aria-label="슬라이드 배경 선택" aria-pressed={selectedPlacementId === BACKGROUND_PLACEMENT_ID} />
      {slide.placements.map((placement, index) => {
        if (placement.elementId === BACKGROUND_ELEMENT_ID) return null;
        const element = elements.get(placement.elementId);
        if (!element) return null;
        const frame = preview?.placementId === placement.id ? preview.frame : placement.frameOverride ?? element.frame;
        const selected = selectedPlacementId === placement.id;
        return (
          <div
            key={placement.id}
            className={`absolute z-30 ${selected ? `ring-2 ${selectionRing}` : ""}`}
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: `${frame.width * 100}%`,
              height: `${frame.height * 100}%`,
              zIndex: index + 30,
            }}
          >
          <button
            type="button"
            className={`relative size-full touch-none cursor-move bg-transparent text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected ? "" : "hover:ring-1 hover:ring-foreground/50"}`}
            onClick={() => onSelect(placement.id)}
            onPointerDown={(event) => beginGesture(event, placement.id, frame, "move")}
            onPointerMove={moveGesture}
            onPointerUp={(event) => void finishGesture(event)}
            onPointerCancel={cancelGesture}
            aria-label={`${element.name} Element 선택`}
            aria-pressed={selected}
          >
          </button>
          {selected && handles.map((handle) => (
            <button key={handle} type="button" disabled={disabled} aria-label={`${element.name} ${handle} 크기 조절`}
              className={`absolute z-10 size-3 rounded-[2px] border ${selectionHandle} shadow-sm touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${handlePositions[handle]}`}
              onPointerDown={(event) => beginGesture(event, placement.id, frame, handle,
                element.kind === "image" && lockImageAspectRatio)}
              onPointerMove={moveGesture} onPointerUp={(event) => void finishGesture(event)} onPointerCancel={cancelGesture} />
          ))}
          </div>
        );
      })}
      {showGuides && <div className="pointer-events-none absolute inset-0 z-50" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 bg-black/15"
          style={{ height: `${CANVAS_SAFE_AREA.top * 100}%` }} />
        <div className="absolute inset-x-0 bottom-0 bg-black/15"
          style={{ height: `${CANVAS_SAFE_AREA.bottom * 100}%` }} />
        <div className="absolute border border-dashed border-emerald-400/80"
          style={{ left: `${CANVAS_SAFE_AREA.left * 100}%`, right: `${CANVAS_SAFE_AREA.right * 100}%`,
            top: `${CANVAS_SAFE_AREA.top * 100}%`, bottom: `${CANVAS_SAFE_AREA.bottom * 100}%` }} />
        <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-emerald-300/25" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-emerald-300/25" />
      </div>}
      {imageDragActive && <div className="pointer-events-none absolute inset-2 z-[60] grid place-items-center rounded-md border-2 border-dashed border-primary bg-background/80 text-sm font-semibold text-foreground shadow-sm">
        여기에 놓아 이미지 추가
      </div>}
    </div>
  );
}
