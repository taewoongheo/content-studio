export type ArtworkImageLoader = (url: string) => Promise<HTMLImageElement>;

// A cache belongs to a mounted editor or a single export, never the whole session.
export function createArtworkImageLoader({ maxBytes = 64 * 1024 * 1024, maxEntries = 40 } = {}): ArtworkImageLoader {
  const cache = new Map<string, { promise: Promise<HTMLImageElement>; bytes: number }>();
  let cachedBytes = 0;
  function prune() {
    while (cachedBytes > maxBytes || cache.size > maxEntries) {
      const oldest = cache.keys().next().value!;
      cachedBytes -= cache.get(oldest)!.bytes;
      cache.delete(oldest);
    }
  }
  return (url) => {
    const cached = cache.get(url);
    if (cached) { cache.delete(url); cache.set(url, cached); return cached.promise; }
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error);
        else resolve(image);
      };
      const timeout = setTimeout(() => finish(new Error("이미지 로딩 시간이 초과되었습니다.")), 15_000);
      image.onload = () => {
        if (image.naturalWidth === 0) finish(new Error("이미지를 읽지 못했습니다."));
        else image.decode().then(() => finish(), () => finish(new Error("이미지를 해석하지 못했습니다.")));
      };
      image.onerror = () => finish(new Error("이미지를 불러오지 못했습니다."));
      image.src = url;
    });
    const entry = { promise: pending, bytes: 0 };
    entry.promise = pending.then((image) => {
      if (cache.get(url) === entry) {
        entry.bytes = image.naturalWidth * image.naturalHeight * 4;
        cachedBytes += entry.bytes;
        prune();
      }
      return image;
    });
    cache.set(url, entry);
    void entry.promise.catch(() => {
      if (cache.get(url) === entry) cache.delete(url);
    });
    prune();
    return entry.promise;
  };
}
