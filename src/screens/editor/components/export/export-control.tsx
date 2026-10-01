"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { SlideArtwork } from "../canvas/slide-artwork";
import { createSlideArchive, exportDimensions, pngDataUrlBytes } from "./archive";

async function waitForArtwork(node: HTMLElement) {
  await window.document.fonts?.ready;
  await Promise.all(Array.from(node.querySelectorAll("img"), async (image) => {
    if (!image.complete) await new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
    await image.decode().catch(() => undefined);
  }));
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export function ExportControl({
  document: editorDocument,
  jobId,
  disabled,
  onBeforeExport,
  onError,
}: {
  document: EditorDocument;
  jobId: string;
  disabled: boolean;
  onBeforeExport: () => Promise<boolean>;
  onError: (message: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const artworkRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dimensions = exportDimensions(editorDocument.aspectRatio);

  async function exportSlides() {
    onError("");
    setExporting(true);
    try {
      if (!(await onBeforeExport())) return;
      await nextPaint();
      const images: Uint8Array[] = [];
      for (const [index] of editorDocument.slides.entries()) {
        const node = artworkRefs.current[index];
        if (!node) throw new Error(`${index + 1}장 렌더러를 찾을 수 없습니다.`);
        await waitForArtwork(node);
        const dataUrl = await toPng(node, {
          width: dimensions.width,
          height: dimensions.height,
          canvasWidth: dimensions.width,
          canvasHeight: dimensions.height,
          pixelRatio: 1,
          cacheBust: true,
        });
        images.push(pngDataUrlBytes(dataUrl));
      }
      const archive = await createSlideArchive(images);
      const url = URL.createObjectURL(archive);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "content-studio-slides.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      onError(error instanceof Error ? error.message : "ZIP 파일을 만들지 못했습니다.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button size="sm" disabled={disabled || exporting} onClick={() => void exportSlides()}>
        {exporting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          : <Download className="size-4" aria-hidden="true" />}
        ZIP 내보내기
      </Button>
      <div className="pointer-events-none fixed -left-[100000px] top-0" aria-hidden="true">
        {editorDocument.slides.map((slide, index) => (
          <SlideArtwork
            key={slide.id}
            ref={(node) => { artworkRefs.current[index] = node; }}
            document={editorDocument}
            slide={slide}
            jobId={jobId}
            showPlaceholders={false}
            clipContent
            style={{ width: dimensions.width, height: dimensions.height }}
          />
        ))}
      </div>
    </>
  );
}
