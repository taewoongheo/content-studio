"use client";
import { useMemo } from "react";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { createArtworkImageLoader } from "@/domains/slideshow/rendering/assets";
import { Thumbnail } from "./template-previews";

export function TemplatePagePicker({ document, projectId, selectedIds, onChange, disabled }: {
  document: EditorDocument; projectId: string; selectedIds: string[]; onChange: (ids: string[]) => void; disabled: boolean;
}) {
  const loadImage = useMemo(() => {
    const loader = createArtworkImageLoader({ maxBytes: 16 * 1024 * 1024 });
    return (url: string) => loader(url.replace("/api/content-jobs/", "/api/content-projects/"));
  }, []);
  return <fieldset disabled={disabled} className="grid gap-3">
    <legend className="mb-2 text-sm font-medium">템플릿에 남길 페이지</legend>
    <p className="text-xs text-muted-foreground">선택한 페이지의 내용과 이미지를 독립적으로 복사합니다. 역할별 장수 제한은 없습니다.</p>
    <div className="grid grid-cols-3 gap-3">
      {document.slides.map((slide, index) => <label key={slide.id} className="grid cursor-pointer justify-items-center gap-2 rounded-lg border p-2 has-checked:border-foreground">
        <Thumbnail document={document} slide={slide} projectId={projectId} loadImage={loadImage} index={index} />
        <span className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedIds.includes(slide.id)} onChange={event =>
          onChange(event.target.checked ? [...selectedIds, slide.id] : selectedIds.filter(id => id !== slide.id))} />
          {slide.name || ({ hook: "훅", body: "본문", cta: "CTA" }[slide.role])}</span>
      </label>)}
    </div>
  </fieldset>;
}
