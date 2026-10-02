import sharp from "sharp";
import { resampledDimensions, type ImageRenderSize } from "./options";

export type RenderImage = { bytes: Uint8Array; type: string };

/** A derived in-memory image only: the source bytes and database are never modified. */
export async function resampleImage(source: RenderImage, target: ImageRenderSize): Promise<RenderImage> {
  const pipeline = sharp(source.bytes);
  const metadata = await pipeline.metadata();
  const swapped = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = swapped ? metadata.height : metadata.width;
  const height = swapped ? metadata.width : metadata.height;
  if (!width || !height) throw new Error("이미지 크기를 읽지 못했습니다.");
  const size = resampledDimensions({ width, height }, target);
  if (size.width === width && size.height === height) return source;
  const bytes = await pipeline.autoOrient().resize({ ...size, fit: "fill", kernel: sharp.kernel.lanczos3,
    fastShrinkOnLoad: false, withoutEnlargement: true }).png().toBuffer();
  return { bytes, type: "image/png" };
}
