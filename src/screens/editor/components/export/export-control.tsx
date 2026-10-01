"use client";

import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { createArtworkImageLoader } from "../canvas/render/assets";
import { createSlideArchive, pngDataUrlBytes } from "./archive";

export function ExportControl({ document, jobId, disabled, onBeforeExport, onError }: {
  document: EditorDocument;
  jobId: string;
  disabled: boolean;
  onBeforeExport: () => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  async function exportSlides() {
    onError("");
    setExporting(true);
    try {
      if (!(await onBeforeExport())) return;
      const { renderArtwork } = await import("../canvas/render/artwork");
      const loadImage = createArtworkImageLoader();
      const images: Uint8Array[] = [];
      for (const slide of document.slides) {
        const { canvas } = await renderArtwork({ document, slide, jobId, loadImage });
        images.push(pngDataUrlBytes(canvas.toDataURL("image/png")));
      }
      const archive = await createSlideArchive(images);
      const url = URL.createObjectURL(archive);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "content-studio-slides.zip";
      link.hidden = true;
      window.document.body.append(link);
      link.click();
      window.setTimeout(() => {
        link.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ZIP 파일을 만들지 못했습니다.");
    } finally {
      setExporting(false);
    }
  }
  return <Button size="sm" disabled={disabled || exporting} onClick={() => void exportSlides()}>
    {exporting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      : <Download className="size-4" aria-hidden="true" />}
    ZIP 내보내기
  </Button>;
}
