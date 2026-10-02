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

export function renderImageUrl(jobId: string, assetId: string, box: { width: number; height: number }, fit: "contain" | "cover") {
  const scale = Math.min(1, 4096 / Math.max(box.width, box.height));
  const dimension = (value: number) => Math.min(4096, Math.max(1, Math.ceil(value)));
  const params = new URLSearchParams({ width: String(dimension(box.width * scale)), height: String(dimension(box.height * scale)), fit });
  return `/api/content-jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(assetId)}?${params}`;
}
