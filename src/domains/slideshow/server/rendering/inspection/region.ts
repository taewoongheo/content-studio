import sharp from "sharp";
import { OperationError } from "@/lib/errors/operation";

export interface PreviewRegion { x: number; y: number; width: number; height: number }

/** Enlarge existing rendered pixels, without moving or repainting document elements. */
export async function previewRegion(bytes: Buffer, region: PreviewRegion) {
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite) ||
    region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 ||
    region.x + region.width > 1 || region.y + region.height > 1)
    throw new OperationError("INVALID_PREVIEW_REGION", "확대 영역은 슬라이드 안의 0~1 비율로 지정해 주세요.");
  const meta = await sharp(bytes).metadata();
  const left = Math.floor(region.x * meta.width!), top = Math.floor(region.y * meta.height!);
  const width = Math.min(meta.width! - left, Math.max(1, Math.ceil(region.width * meta.width!)));
  const height = Math.min(meta.height! - top, Math.max(1, Math.ceil(region.height * meta.height!)));
  const scale = Math.min(2, 1080 / Math.max(width, height));
  return sharp(bytes).extract({ left, top, width, height })
    .resize(Math.round(width * scale), Math.round(height * scale)).png().toBuffer();
}
