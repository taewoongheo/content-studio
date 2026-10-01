import type { EditorDocument, ElementFrame } from "@/lib/content-jobs/editor/types";

export function artworkSize(aspectRatio: EditorDocument["aspectRatio"]) {
  return { width: 1080, height: aspectRatio === "4:5" ? 1350 : aspectRatio === "9:16" ? 1920 : 1080 };
}

export function pixelFrame(frame: ElementFrame, size: { width: number; height: number }) {
  return { x: frame.x * size.width, y: frame.y * size.height,
    width: frame.width * size.width, height: frame.height * size.height };
}

export function fittedImage(source: { width: number; height: number }, box: { width: number; height: number }, fit: "contain" | "cover") {
  const scale = (fit === "cover" ? Math.max : Math.min)(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}
