"use client";

import { useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import type { EditorDocument, EditorSlide, ElementFrame, ElementStyle } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/document";
import { CANVAS_SAFE_AREA, fontSizeForFrameResize, moveOrResizeFrame, type DragMode } from "./frame-geometry";

type Gesture = { pointerId: number; placementId: string; mode: DragMode; startX: number; startY: number;
  canvasWidth: number; canvasHeight: number; frame: ElementFrame; lockAspectRatio: boolean; fontSize?: number };
const handles = ["nw", "ne", "sw", "se"] as const;
const handlePositions = { nw: "-left-1.5 -top-1.5 cursor-nwse-resize", ne: "-right-1.5 -top-1.5 cursor-nesw-resize",
  sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize", se: "-bottom-1.5 -right-1.5 cursor-nwse-resize" } as const;

export function SlideCanvas({
  document,
  slide,
  jobId,
  selectedPlacementId,
  disabled,
  showGuides,
  lockImageAspectRatio,
  onSelect,
  onSelectBackground,
  onVisualChange,
}: {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  selectedPlacementId: string | null;
  disabled: boolean;
  showGuides: boolean;
  lockImageAspectRatio: boolean;
  onSelect: (placementId: string) => void;
  onSelectBackground: () => void;
  onVisualChange: (placementId: string, frame: ElementFrame, style?: Partial<ElementStyle>) => Promise<boolean>;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ placementId: string; frame: ElementFrame; fontSize?: number } | null>(null);
  const elements = new Map(document.elements.map((element) => [element.id, element]));

  function beginGesture(event: PointerEvent<HTMLButtonElement>, placementId: string, frame: ElementFrame, mode: DragMode,
    lockAspectRatio = false, fontSize?: number) {
    event.stopPropagation();
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
      canvasWidth: bounds.width, canvasHeight: bounds.height, frame: renderedFrame, lockAspectRatio, fontSize };
  }

  function frameAtPointer(event: PointerEvent<HTMLButtonElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return null;
    const frame = moveOrResizeFrame(active.frame, active.mode,
      (event.clientX - active.startX) / active.canvasWidth, (event.clientY - active.startY) / active.canvasHeight,
      showGuides, active.lockAspectRatio);
    return { placementId: active.placementId, frame,
      ...(active.fontSize !== undefined && active.mode !== "move"
        ? { fontSize: fontSizeForFrameResize(active.fontSize, active.frame, frame) } : {}) };
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
      await onVisualChange(next.placementId, next.frame,
        next.fontSize === undefined ? undefined : { fontSize: next.fontSize });
    } finally {
      setPreview(null);
    }
  }

  function cancelGesture(event: PointerEvent<HTMLButtonElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    setPreview(null);
  }

  return (
    <div
      ref={canvasRef}
      className={`relative mx-auto h-full w-auto max-h-full max-w-full overflow-hidden border bg-white shadow-sm ${selectedPlacementId === BACKGROUND_PLACEMENT_ID ? "ring-2 ring-foreground/70 ring-offset-2" : ""}`}
      style={{ aspectRatio: document.aspectRatio.replace(":", "/"), backgroundColor: slide.backgroundColor, containerType: "inline-size" }}
      aria-label={`${slide.role} 슬라이드 미리보기`}
    >
      <button type="button" className="absolute inset-0 size-full cursor-default border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-foreground" onClick={onSelectBackground} aria-label="슬라이드 배경 선택" aria-pressed={selectedPlacementId === BACKGROUND_PLACEMENT_ID} />
      {slide.placements.map((placement, index) => {
        if (placement.elementId === BACKGROUND_ELEMENT_ID) return null;
        const element = elements.get(placement.elementId);
        if (!element) return null;
        const frame = preview?.placementId === placement.id ? preview.frame : placement.frameOverride ?? element.frame;
        const style = { ...element.style, ...placement.styleOverride };
        const selected = selectedPlacementId === placement.id;
        const isText = element.kind === "text";
        const previewFontSize = preview?.placementId === placement.id ? preview.fontSize : undefined;
        return (
          <div
            key={placement.id}
            className={`absolute ${selected ? "ring-2 ring-primary" : ""}`}
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: isText ? "max-content" : `${frame.width * 100}%`,
              maxWidth: isText ? `${Math.min(frame.width, 1 - frame.x) * 100}%` : undefined,
              height: isText ? "auto" : `${frame.height * 100}%`,
              zIndex: selected ? slide.placements.length + 2 : index + 1,
            }}
          >
          <button
            type="button"
            className={`relative touch-none cursor-move text-left outline-none focus-visible:ring-2 focus-visible:ring-primary ${isText ? "inline-flex max-w-full overflow-visible" : "size-full overflow-hidden"} ${selected ? "" : "hover:ring-1 hover:ring-foreground/50"}`}
            style={{
              backgroundColor: element.kind === "text" || element.kind === "image" ? style.backgroundColor : "transparent",
              color: style.color,
              fontSize: `${(previewFontSize ?? style.fontSize) / 10.8}cqw`,
              lineHeight: style.lineHeight,
              fontWeight: style.fontWeight,
              textAlign: style.textAlign,
              fontFamily: style.fontFamily,
              borderRadius: element.kind === "circle" ? "50%" : `${style.borderRadius / 10.8}cqw`,
            }}
            onClick={() => onSelect(placement.id)}
            onPointerDown={(event) => beginGesture(event, placement.id, frame, "move")}
            onPointerMove={moveGesture}
            onPointerUp={(event) => void finishGesture(event)}
            onPointerCancel={cancelGesture}
            aria-label={`${element.name} Element 선택`}
            aria-pressed={selected}
          >
            {element.kind === "rectangle" || element.kind === "circle" || element.kind === "triangle" ? (
              <span className="block size-full" style={{ backgroundColor: style.backgroundColor,
                borderRadius: element.kind === "circle" ? "50%" : `${style.borderRadius / 10.8}cqw`,
                clipPath: element.kind === "triangle" ? "polygon(50% 0, 0 100%, 100% 100%)" : undefined }} />
            ) : element.kind === "image" ? (
              placement.value ? (
                <Image
                  src={`/api/content-jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(placement.value)}`}
                  alt={element.name}
                  fill
                  unoptimized
                  sizes="380px"
                  style={{ objectFit: style.imageFit }}
                />
              ) : (
                <span className="grid size-full place-items-center border border-dashed border-muted-foreground/40 bg-muted/40 p-2 text-center text-xs font-medium text-muted-foreground">
                  {element.name}
                </span>
              )
            ) : (
              <span className={`inline-block max-w-full whitespace-pre-wrap break-words px-[1cqw] py-[0.5cqw] ${placement.value ? "" : "text-muted-foreground/70"}`}>
                {placement.value || element.name}
              </span>
            )}
          </button>
          {selected && handles.map((handle) => (
            <button key={handle} type="button" disabled={disabled} aria-label={`${element.name} ${handle} 크기 조절`}
              className={`absolute z-10 size-3 rounded-[2px] border border-primary bg-background shadow-sm touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${handlePositions[handle]}`}
              onPointerDown={(event) => beginGesture(event, placement.id, frame, handle,
                (element.kind === "image" && lockImageAspectRatio) || isText, isText ? style.fontSize : undefined)}
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
    </div>
  );
}
