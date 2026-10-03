"use client";
import { useEffect } from "react";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import { renderArtwork } from "@/screens/editor/components/canvas/render/artwork";
import { createArtworkImageLoader } from "@/screens/editor/components/canvas/render/assets";

declare global {
  interface Window {
    renderStudioPreview?: (job: ContentJobSnapshot, slideId: string) => Promise<string>;
  }
}
export default function PreviewPage() {
  useEffect(() => {
    window.renderStudioPreview = async (job, slideId) => {
      const slide = job.editor.document.slides.find((item) => item.id === slideId);
      if (!slide) throw new Error("슬라이드를 찾을 수 없습니다.");
      const { canvas } = await renderArtwork({ document: job.editor.document, slide,
        jobId: job.id, loadImage: createArtworkImageLoader() });
      return canvas.toDataURL("image/png");
    };
    return () => { delete window.renderStudioPreview; };
  }, []);
  return <p>슬라이드 미리보기 렌더러</p>;
}
