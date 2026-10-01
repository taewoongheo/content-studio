export type ArtworkImageLoader = (url: string) => Promise<HTMLImageElement>;

// A cache belongs to a mounted editor or a single export, never the whole session.
export function createArtworkImageLoader(): ArtworkImageLoader {
  const cache = new Map<string, Promise<HTMLImageElement>>();
  return (url) => {
    const cached = cache.get(url);
    if (cached) return cached;
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
    cache.set(url, pending);
    void pending.catch(() => cache.delete(url));
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    return pending;
  };
}
