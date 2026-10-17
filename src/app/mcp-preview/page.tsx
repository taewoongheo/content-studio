"use client";
import { useEffect } from "react";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { renderArtwork } from "@/domains/slideshow/rendering/artwork";
import { createArtworkImageLoader } from "@/domains/slideshow/rendering/assets";

declare global {
  interface Window {
    renderStudioPreview?: (job: ContentJobSnapshot, slideId: string, width?: number, images?: Record<string, string>) => Promise<string>;
  }
}
export default function PreviewPage() {
  useEffect(() => {
    const loadImage = createArtworkImageLoader();
    window.renderStudioPreview = async (job, slideId, width, images) => {
      const slide = job.editor.document.slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("슬라이드를 찾을 수 없습니다.");
      const { canvas } = await renderArtwork({ document: job.editor.document, slide,
        jobId: job.id, loadImage: url => {
          const id = decodeURIComponent(new URL(url, window.location.origin).pathname.split("/assets/")[1] ?? "");
          return loadImage(images?.[id] ?? url);
        } });
      if (!width || width >= canvas.width) return canvas.toDataURL("image/png");
      const thumbnail = document.createElement("canvas");
      thumbnail.width = width; thumbnail.height = Math.round(canvas.height * width / canvas.width);
      thumbnail.getContext("2d")!.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
      return thumbnail.toDataURL("image/png");
    };
    return () => { delete window.renderStudioPreview; };
  }, []);
  return <p>슬라이드 미리보기 렌더러</p>;
}
