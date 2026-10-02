import { createHash } from "node:crypto";
import type { ImageRenderSize } from "./options";
import { resampleImage, type RenderImage } from "./resample";

export function createRenderImageCache({ maxBytes = 32 * 1024 * 1024, maxEntries = 64,
  transform = resampleImage }: { maxBytes?: number; maxEntries?: number;
    transform?: typeof resampleImage } = {}) {
  const cache = new Map<string, RenderImage>();
  const pending = new Map<string, Promise<RenderImage>>();
  let bytes = 0;
  return (source: RenderImage, target: ImageRenderSize): Promise<RenderImage> => {
    // Content-derived keys prevent stale pixels when an asset's underlying bytes change.
    const key = `${createHash("sha256").update(source.bytes).digest("hex")}:${source.type}:${target.width}:${target.height}:${target.fit}`;
    const cached = cache.get(key);
    if (cached) { cache.delete(key); cache.set(key, cached); return Promise.resolve(cached); }
    const running = pending.get(key);
    if (running) return running;
    const promise = transform(source, target).then((image) => {
      if (image.bytes.byteLength <= maxBytes) {
        cache.set(key, image);
        bytes += image.bytes.byteLength;
        while (bytes > maxBytes || cache.size > maxEntries) {
          const oldest = cache.keys().next().value!;
          bytes -= cache.get(oldest)!.bytes.byteLength;
          cache.delete(oldest);
        }
      }
      return image;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}

// Disposable bounded cache; no project data or derivatives are persisted here.
export const cachedRenderImage = createRenderImageCache();
