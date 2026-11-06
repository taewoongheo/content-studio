"use client";
import { useEffect } from "react";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { createArtworkScene } from "@/domains/slideshow/rendering/artwork";
import { createArtworkImageLoader } from "@/domains/slideshow/rendering/assets";

import type { SlideLayout } from "@/domains/slideshow/rendering/inspection/metrics";

declare global {
  interface Window {
    inspectStudioLayout?: (job: ContentJobSnapshot, slideId: string, images?: Record<string,string>) => Promise<SlideLayout>;
    renderStudioPreview?: (job: ContentJobSnapshot, slideId: string, width?: number, images?: Record<string, string>) => Promise<string>;
  }
}
export default function PreviewPage() {
  useEffect(() => {
    const loadImage = createArtworkImageLoader();
    const scene = async (job: ContentJobSnapshot, slideId: string, images?: Record<string,string>) => {
      const slide = job.editor.document.slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("슬라이드를 찾을 수 없습니다.");
      return createArtworkScene({ document: job.editor.document, slide,
        jobId: job.id, loadImage: url => {
          const id = decodeURIComponent(new URL(url, window.location.origin).pathname.split("/assets/")[1] ?? "");
          return loadImage(images?.[id] ?? url);
        } });
    };
    window.inspectStudioLayout = async (job, slideId, images) => {
      const artwork = await scene(job,slideId,images);
      try { return artwork.inspectLayout(); } finally { artwork.destroy(); }
    };
    window.renderStudioPreview = async (job,slideId,width,images) => {
      const artwork = await scene(job,slideId,images);
      try {
        const canvas = artwork.snapshot();
        if (!width || width >= canvas.width) return canvas.toDataURL("image/png");
        const thumbnail = document.createElement("canvas");
        thumbnail.width = width; thumbnail.height = Math.round(canvas.height * width / canvas.width);
        thumbnail.getContext("2d")!.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
        return thumbnail.toDataURL("image/png");
      } finally { artwork.destroy(); }
    };
    return () => { delete window.renderStudioPreview; delete window.inspectStudioLayout; };
  }, []);
  return <p>슬라이드 미리보기 렌더러</p>;
}
