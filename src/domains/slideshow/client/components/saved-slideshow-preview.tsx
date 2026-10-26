"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorDocument, EditorSlide } from "../../editor/types";
import type { SavedProjectSummary } from "../../domain/projects";
import { createArtworkImageLoader } from "../../rendering/assets";
import { readSavedDocument } from "../projects-api";

function useVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "240px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

function SavedSlide({ projectId, document, slide, index }: {
  projectId: string; document: EditorDocument; slide: EditorSlide; index: number;
}) {
  const { ref, visible } = useVisible();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const loadImage = createArtworkImageLoader({ maxBytes: 12 * 1024 * 1024 });
    void import("../../rendering/artwork").then(({ renderArtwork }) => renderArtwork({
      document, slide, jobId: projectId, signal: controller.signal,
      loadImage: source => {
        const url = new URL(source.replace("/api/content-jobs/", "/api/content-projects/"), window.location.origin);
        // Match the thumbnail's resolution instead of downloading full-size derivatives.
        for (const dimension of ["width", "height"]) {
          const value = Number(url.searchParams.get(dimension));
          if (value) url.searchParams.set(dimension, String(Math.max(1, Math.ceil(value / 3))));
        }
        return loadImage(url.toString());
      },
    })).then(result => {
      if (controller.signal.aborted || !canvas.current) return;
      const target = canvas.current;
      target.width = 360;
      target.height = Math.round(result.canvas.height * 360 / result.canvas.width);
      target.getContext("2d")?.drawImage(result.canvas, 0, 0, target.width, target.height);
      setError("");
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "미리보기를 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [visible, document, slide, projectId]);
  return <div ref={ref} className="w-[180px] shrink-0 snap-start">
    <div className="relative overflow-hidden rounded-lg border bg-muted" style={{ aspectRatio: document.aspectRatio.replace(":", "/") }}>
      {visible && <canvas ref={canvas} role="img" aria-label={`${index + 1}번 슬라이드`} className="absolute inset-0 h-full w-full" />}
      {error && <p role="alert" className="absolute inset-0 overflow-auto bg-background/95 p-3 text-xs text-destructive">{error}</p>}
    </div>
    <span className="mt-2 block text-center text-xs text-muted-foreground">{index + 1}</span>
  </div>;
}

export function SavedSlideshowPreview({ project }: { project: SavedProjectSummary }) {
  const { ref, visible } = useVisible();
  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!visible || document) return;
    const controller = new AbortController();
    readSavedDocument(project.id, controller.signal).then(setDocument).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "슬라이드를 불러오지 못했습니다.");
    });
    return () => controller.abort();
  }, [visible, document, project.id, attempt]);
  return <div ref={ref} role="region" aria-label={`${project.name} 슬라이드 미리보기`} tabIndex={0}
    className="mt-4 flex min-w-0 snap-x gap-3 overflow-x-auto pb-2">
    {document ? document.slides.map((slide, index) =>
      <SavedSlide key={slide.id} projectId={project.id} document={document} slide={slide} index={index} />)
      : error ? <div role="alert" className="py-6 text-sm text-destructive">{error}
        <button type="button" className="ml-3 underline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>다시 시도</button>
      </div> : <div className="flex gap-3" role="status" aria-label="슬라이드 불러오는 중">
        {Array.from({ length: Math.min(project.slideCount, 4) }, (_, index) =>
          <div key={index} className="w-[180px] shrink-0 rounded-lg border bg-muted" style={{ aspectRatio: project.aspectRatio.replace(":", "/") }} />)}
      </div>}
  </div>;
}
