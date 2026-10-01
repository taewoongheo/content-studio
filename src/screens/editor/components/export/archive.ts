import JSZip from "jszip";
import type { EditorDocument } from "@/lib/content-jobs/editor/types";

export type ExportDimensions = { width: number; height: number };

const dimensionsByAspectRatio: Record<EditorDocument["aspectRatio"], ExportDimensions> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

export function exportDimensions(aspectRatio: EditorDocument["aspectRatio"]) {
  return dimensionsByAspectRatio[aspectRatio];
}

export function slideFilename(index: number, slideCount: number) {
  const digits = Math.max(2, String(slideCount).length);
  return `slide-${String(index + 1).padStart(digits, "0")}.png`;
}

export function pngDataUrlBytes(dataUrl: string) {
  const marker = "data:image/png;base64,";
  if (!dataUrl.startsWith(marker)) throw new Error("PNG 이미지 데이터가 올바르지 않습니다.");
  const binary = atob(dataUrl.slice(marker.length));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function createSlideArchive(images: readonly Uint8Array[]) {
  const zip = new JSZip();
  images.forEach((image, index) => {
    zip.file(slideFilename(index, images.length), image, { binary: true, compression: "STORE" });
  });
  return zip.generateAsync({ type: "blob", compression: "STORE", streamFiles: true });
}
