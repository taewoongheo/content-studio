"use client";

import { forwardRef, type HTMLAttributes } from "react";
import Image from "next/image";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID } from "@/lib/content-jobs/editor/document";

export type FramePreview = { placementId: string; frame: ElementFrame } | null;

type SlideArtworkProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  framePreview?: FramePreview;
  showPlaceholders?: boolean;
  clipContent?: boolean;
};

export const SlideArtwork = forwardRef<HTMLDivElement, SlideArtworkProps>(function SlideArtwork({
  document,
  slide,
  jobId,
  framePreview = null,
  showPlaceholders = true,
  clipContent = false,
  className = "",
  style: rootStyle,
  ...props
}, ref) {
  const elements = new Map(document.elements.map((element) => [element.id, element]));

  return (
    <div
      ref={ref}
      className={`relative bg-white ${clipContent ? "overflow-hidden" : "overflow-visible"} ${className}`}
      style={{
        aspectRatio: document.aspectRatio.replace(":", "/"),
        backgroundColor: slide.backgroundColor,
        containerType: "inline-size",
        ...rootStyle,
      }}
      {...props}
    >
      {slide.placements.map((placement, index) => {
        if (placement.elementId === BACKGROUND_ELEMENT_ID) return null;
        const element = elements.get(placement.elementId);
        if (!element) return null;
        const frame = framePreview?.placementId === placement.id
          ? framePreview.frame
          : placement.frameOverride ?? element.frame;
        const elementStyle = { ...element.style, ...placement.styleOverride };

        return (
          <div
            key={placement.id}
            data-placement-id={placement.id}
            className="absolute overflow-hidden"
            style={{
              left: `${frame.x * 100}%`,
              top: `${frame.y * 100}%`,
              width: `${frame.width * 100}%`,
              height: `${frame.height * 100}%`,
              zIndex: index + 1,
              backgroundColor: element.kind === "text" || element.kind === "image"
                ? elementStyle.backgroundColor
                : "transparent",
              color: elementStyle.color,
              fontSize: `${elementStyle.fontSize / 10.8}cqw`,
              lineHeight: elementStyle.lineHeight,
              fontWeight: elementStyle.fontWeight,
              textAlign: elementStyle.textAlign,
              fontFamily: elementStyle.fontFamily,
              borderRadius: element.kind === "circle" ? "50%" : `${elementStyle.borderRadius / 10.8}cqw`,
            }}
          >
            {element.kind === "rectangle" || element.kind === "circle" || element.kind === "triangle" ? (
              <span
                className="block size-full"
                style={{
                  backgroundColor: elementStyle.backgroundColor,
                  borderRadius: element.kind === "circle" ? "50%" : `${elementStyle.borderRadius / 10.8}cqw`,
                  clipPath: element.kind === "triangle" ? "polygon(50% 0, 0 100%, 100% 100%)" : undefined,
                }}
              />
            ) : element.kind === "image" ? (
              placement.value ? (
                <Image
                  src={`/api/content-jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(placement.value)}`}
                  alt={element.name}
                  fill
                  unoptimized
                  sizes="1080px"
                  style={{ objectFit: elementStyle.imageFit }}
                />
              ) : showPlaceholders ? (
                <span className="grid size-full place-items-center border border-dashed border-muted-foreground/40 bg-muted/40 p-2 text-center text-xs font-medium text-muted-foreground">
                  {element.name}
                </span>
              ) : null
            ) : placement.value || showPlaceholders ? (
              <span className={`block w-full whitespace-pre-wrap break-words px-[1cqw] py-[0.5cqw] ${placement.value ? "" : "text-muted-foreground/70"}`}>
                {placement.value || element.name}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
