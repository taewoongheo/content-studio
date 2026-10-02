import { ContentJobError } from "../../workflow/registry";

export const MAX_RENDER_IMAGE_DIMENSION = 4096;
export type ImageRenderSize = { width: number; height: number; fit: "contain" | "cover" };

export function imageRenderSize(params: URLSearchParams): ImageRenderSize | null {
  if (!["width", "height", "fit"].some((key) => params.has(key))) return null;
  const width = Number(params.get("width"));
  const height = Number(params.get("height"));
  const fit = params.get("fit");
  if (![width, height].every((value) => Number.isInteger(value) && value >= 1 && value <= MAX_RENDER_IMAGE_DIMENSION) ||
    (fit !== "contain" && fit !== "cover"))
    throw new ContentJobError("INVALID_OUTPUT", "이미지 렌더 크기가 올바르지 않습니다.");
  return { width, height, fit };
}

export function resampledDimensions(source: { width: number; height: number }, target: ImageRenderSize) {
  const fitScale = (target.fit === "cover" ? Math.max : Math.min)(target.width / source.width, target.height / source.height);
  const scale = Math.min(1, fitScale, MAX_RENDER_IMAGE_DIMENSION / Math.max(source.width, source.height));
  return { width: Math.max(1, Math.round(source.width * scale)), height: Math.max(1, Math.round(source.height * scale)) };
}
