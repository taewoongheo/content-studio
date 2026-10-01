"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorDocument } from "@/lib/content-jobs/editor/types";
import { SlideArtwork } from "../canvas/slide-artwork";
import { createSlideArchive, exportDimensions, pngDataUrlBytes } from "./archive";

const IMAGE_LOAD_TIMEOUT_MS = 15_000;

function waitForImage(image: HTMLImageElement) {
  if (image.complete) {
    if (image.naturalWidth === 0) return Promise.reject(new Error("내보낼 이미지를 불러오지 못했습니다."));
    return image.decode().catch(() => undefined);
  }
  return new Promise<void>((resolve, reject) => {
    const finish = (result: "load" | "error" | "timeout") => {
      window.clearTimeout(timeout);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      if (result === "load") void image.decode().catch(() => undefined).then(() => resolve());
      else reject(new Error(result === "timeout"
        ? "이미지 로딩 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
        : "내보낼 이미지를 불러오지 못했습니다."));
    };
    const handleLoad = () => finish("load");
    const handleError = () => finish("error");
    const timeout = window.setTimeout(() => finish("timeout"), IMAGE_LOAD_TIMEOUT_MS);
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
  });
}

async function waitForArtwork(node: HTMLElement) {
  await window.document.fonts?.ready;
  await Promise.all(Array.from(node.querySelectorAll("img"), waitForImage));
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
            loadImagesEagerly
            style={{ width: dimensions.width, height: dimensions.height }}
          />
        ))}
      </div>
    </>
  );
}
