import sharp from "sharp";
import { isMediaUrl } from "../domain/source";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export async function readSourceImage(raw: string) {
  let url = raw;
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (!isMediaUrl(url)) throw new Error("The image URL is not a supported platform media host.");
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location) throw new Error("The source image returned an invalid redirect.");
      url = new URL(location, url).toString(); continue;
    }
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      await response.body?.cancel(); throw new Error("The source image is unavailable. Recollect the post if its URL expired.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("The source image returned no bytes.");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_IMAGE_BYTES) throw new Error("The source image exceeded 10 MB.");
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const input = Buffer.concat(chunks);
    const output = await sharp(input, { limitInputPixels: 32_000_000 }).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return { type: "image" as const, mimeType: "image/png", data: output.toString("base64") };
  }
  throw new Error("The source image returned too many redirects.");
}
