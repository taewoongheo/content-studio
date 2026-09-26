"use client";

import Image from "next/image";
import type { EditorDocument, EditorSlide } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/document";

export function SlideCanvas({
  document,
  slide,
  jobId,
  selectedPlacementId,
  onSelect,
  onSelectBackground,
}: {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  selectedPlacementId: string | null;
  onSelect: (placementId: string) => void;
  onSelectBackground: () => void;
}) {
  const elements = new Map(document.elements.map((element) => [element.id, element]));
  return (
    <div
      className={`relative mx-auto h-full w-auto max-h-full max-w-full overflow-hidden border bg-white shadow-sm ${selectedPlacementId === BACKGROUND_PLACEMENT_ID ? "ring-2 ring-foreground/70 ring-offset-2" : ""}`}
      style={{ aspectRatio: document.aspectRatio.replace(":", "/"), backgroundColor: slide.backgroundColor, containerType: "inline-size" }}
      aria-label={`${slide.role} 슬라이드 미리보기`}
    >
      <button type="button" className="absolute inset-0 size-full cursor-default border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-foreground" onClick={onSelectBackground} aria-label="슬라이드 배경 선택" aria-pressed={selectedPlacementId === BACKGROUND_PLACEMENT_ID} />
      {slide.placements.map((placement, index) => {
        if (placement.elementId === BACKGROUND_ELEMENT_ID) return null;
        const element = elements.get(placement.elementId);
        if (!element) return null;
        const frame = placement.frameOverride ?? element.frame;
        const style = { ...element.style, ...placement.styleOverride };
        return (
          <button
            key={placement.id}
            type="button"
            className={`absolute overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-foreground ${selectedPlacementId === placement.id ? "ring-2 ring-foreground" : "hover:ring-1 hover:ring-foreground/50"}`}
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: `${frame.width * 100}%`,
              height: `${frame.height * 100}%`,
              zIndex: index + 1,
              backgroundColor: element.kind === "text" || element.kind === "image" ? style.backgroundColor : "transparent",
              color: style.color,
              fontSize: `${style.fontSize / 10.8}cqw`,
              fontWeight: style.fontWeight,
              textAlign: style.textAlign,
              fontFamily: style.fontFamily,
              borderRadius: element.kind === "circle" ? "50%" : `${style.borderRadius / 10.8}cqw`,
            }}
            onClick={() => onSelect(placement.id)}
            aria-label={`${element.name} Element 선택`}
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
              <span className={`flex size-full items-center justify-center whitespace-pre-wrap break-words p-[2%] leading-tight ${placement.value ? "" : "text-muted-foreground/70"}`}>
                {placement.value || element.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
