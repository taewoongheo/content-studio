"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/lib/content-jobs/editor/types";
import { createArtworkImageLoader } from "./render/assets";

export type FramePreview = { placementId: string; frame: ElementFrame } | null;
type SlideArtworkProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  framePreview?: FramePreview;
};

export function SlideArtwork({ document, slide, jobId, framePreview = null,
  className = "", style, ...props }: SlideArtworkProps) {
  const host = useRef<HTMLDivElement>(null);
  const [loadImage] = useState(createArtworkImageLoader);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void import("./render/artwork").then(({ renderArtwork }) => renderArtwork({
      document, slide, jobId, framePreview, loadImage, showPlaceholders: true, allowOverflow: true,
    })).then(({ canvas, x, y, width, height, size }) => {
      if (cancelled || !host.current) return;
      canvas.style.position = "absolute";
      canvas.style.left = `${x / size.width * 100}%`;
      canvas.style.top = `${y / size.height * 100}%`;
      canvas.style.width = `${width / size.width * 100}%`;
      canvas.style.height = `${height / size.height * 100}%`;
      host.current.replaceChildren(canvas);
      setError("");
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : "슬라이드를 그리지 못했습니다.");
    });
    return () => { cancelled = true; };
  }, [document, slide, jobId, framePreview, loadImage]);

  return <div className={`relative ${className}`} style={{ aspectRatio: document.aspectRatio.replace(":", "/"), ...style }} {...props}>
    <div ref={host} className="absolute inset-0" />
    {error && <p role="alert" className="absolute inset-x-0 top-0 bg-background p-2 text-xs text-destructive">{error}</p>}
  </div>;
}
