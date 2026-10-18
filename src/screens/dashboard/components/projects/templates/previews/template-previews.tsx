"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SlideshowSummary } from "@/domains/slideshow/domain/projects";
import type { EditorDocument, EditorSlide } from "@/domains/slideshow/editor/types";
import { createArtworkImageLoader, type ArtworkImageLoader } from "@/domains/slideshow/rendering/assets";

function useVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, visible };
}

export function Thumbnail({ document, slide, projectId, loadImage, index }: {
  document: EditorDocument; slide: EditorSlide; projectId: string; loadImage: ArtworkImageLoader; index: number;
}) {
  const { ref, visible } = useVisible();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void import("@/domains/slideshow/rendering/artwork").then(({ renderArtwork }) =>
      renderArtwork({ document, slide, jobId: projectId, loadImage, signal: controller.signal })
    ).then(({ canvas }) => {
      if (controller.signal.aborted || !ref.current) return;
      const thumbnail = window.document.createElement("canvas");
      thumbnail.width = 200;
      thumbnail.height = Math.round(200 * canvas.height / canvas.width);
      thumbnail.getContext("2d")!.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);
      thumbnail.style.width = "100%";
      thumbnail.style.height = "100%";
      ref.current.replaceChildren(thumbnail);
      // Retain only the small thumbnail, releasing the full resolution snapshot.
      canvas.width = canvas.height = 0;
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [visible, document, slide, projectId, loadImage, ref]);
  return <figure className="w-24 shrink-0">
    <div ref={ref} role="img" aria-label={`${index + 1}번 슬라이드: ${slide.name}`}
      className="overflow-hidden rounded-md border bg-muted" style={{ aspectRatio: document.aspectRatio.replace(":", "/") }}>
      {failed && <span className="block p-2 text-xs text-muted-foreground">미리보기 오류</span>}
    </div>
    <figcaption className="mt-1 text-center text-xs text-muted-foreground">{index + 1}</figcaption>
  </figure>;
}

export function TemplatePreviews({ project }: { project: SlideshowSummary }) {
  const { ref, visible } = useVisible();
  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [error, setError] = useState(false);
  const loadImage = useMemo(() => {
    const loader = createArtworkImageLoader({ maxBytes: 16 * 1024 * 1024 });
    return (url: string) => loader(`${url.replace("/api/content-jobs/", "/api/content-projects/")}&version=${encodeURIComponent(project.updatedAt)}`);
  }, [project.updatedAt]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    void fetch(`/api/content-projects/${encodeURIComponent(project.id)}/preview`, { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<EditorDocument>; })
      .then(value => { if (!controller.signal.aborted) { setDocument(value); setError(false); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [visible, project.id, project.updatedAt]);
  return <div ref={ref} role="region" aria-label={`${project.name} 슬라이드 미리보기`} tabIndex={0}
    className="mt-3 max-w-full overflow-x-auto rounded-md pb-2 focus-visible:outline-2">
    <div className="flex w-max gap-2">
      {document ? document.slides.map((slide, index) => <Thumbnail key={slide.id} document={document} slide={slide}
        projectId={project.id} loadImage={loadImage} index={index} />) : <p className="py-3 text-xs text-muted-foreground">{error ? "미리보기를 불러오지 못했습니다." : "미리보기 불러오는 중…"}</p>}
    </div>
  </div>;
}
