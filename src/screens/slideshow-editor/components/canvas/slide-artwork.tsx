"use client";

import { useEffect, useEffectEvent, useRef, useState, type HTMLAttributes } from "react";
import type { EditorDocument, EditorSlide, ElementFrame } from "@/domains/slideshow/editor/types";
import type { ArtworkScene } from "@/domains/slideshow/rendering/artwork";
import { createArtworkImageLoader } from "@/domains/slideshow/rendering/assets";

export type FramePreview = { placementId: string; frame: ElementFrame } | null;
type SlideArtworkProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  document: EditorDocument;
  slide: EditorSlide;
  jobId: string;
  framePreview?: FramePreview;
  onLoadSettled?: () => void;
};

export function SlideArtwork({ document, slide, jobId, framePreview = null, onLoadSettled,
  className = "", style, ...props }: SlideArtworkProps) {
  const notifyLoadSettled = useEffectEvent(() => onLoadSettled?.());
  const host = useRef<HTMLDivElement>(null);
  const [loadImage] = useState(createArtworkImageLoader);
  const [error, setError] = useState("");
  const sceneRef = useRef<ArtworkScene | null>(null);
  const previewRef = useRef(framePreview);
  useEffect(() => {
    previewRef.current = framePreview;
    const scene = sceneRef.current;
    if (scene) display(scene.updatePreview(framePreview));
  }, [framePreview]);

  function display({ canvas, x, y, width, height, size }: Pick<ArtworkScene, "canvas" | "x" | "y" | "width" | "height" | "size">) {
    if (!host.current) return;
    canvas.style.position = "absolute";
    canvas.style.left = `${x / size.width * 100}%`;
    canvas.style.top = `${y / size.height * 100}%`;
    canvas.style.width = `${width / size.width * 100}%`;
    canvas.style.height = `${height / size.height * 100}%`;
    if (host.current.firstChild !== canvas) host.current.replaceChildren(canvas);
  }

  useEffect(() => {
    const controller = new AbortController();
    let scene: ArtworkScene | null = null;
    void import("@/domains/slideshow/rendering/artwork").then(({ createArtworkScene }) => {
      controller.signal.throwIfAborted();
      return createArtworkScene({
        document, slide, jobId, loadImage, showPlaceholders: true, allowOverflow: true,
        signal: controller.signal,
      });
    }).then((created) => {
      if (controller.signal.aborted) { created.destroy(); return; }
      scene = created;
      sceneRef.current = created;
      display(created.updatePreview(previewRef.current));
      setError("");
      notifyLoadSettled();
    }).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "슬라이드를 그리지 못했습니다.");
        notifyLoadSettled();
      }
    });
    return () => {
      controller.abort();
      if (sceneRef.current === scene) sceneRef.current = null;
      scene?.destroy();
    };
  }, [document, slide, jobId, loadImage]);

  return <div className={`relative ${className}`} style={{ aspectRatio: document.aspectRatio.replace(":", "/"), ...style }} {...props}>
    <div ref={host} className="absolute inset-0" />
    {error && <p role="alert" className="absolute inset-x-0 top-0 bg-background p-2 text-xs text-destructive">{error}</p>}
  </div>;
}
