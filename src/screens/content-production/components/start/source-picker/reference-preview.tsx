"use client";

/** Stored thumbnails only. The native lazy loader defers offscreen slides in this scroll strip. */
export function ReferencePreview({ setId, slideCount }: { setId: string; slideCount: number }) {
  return <div role="region" aria-label="스파이 게시글 슬라이드 미리보기" tabIndex={0}
    className="mt-2 flex min-w-0 snap-x gap-2 overflow-x-auto overflow-y-hidden pb-2 [@media(max-height:450px)]:mt-1 [@media(max-height:450px)]:pb-1">
    {Array.from({ length: slideCount }, (_, index) => <div key={index} className="shrink-0 snap-start" style={{ width: "calc(clamp(48px, 12dvh, 140px) * 0.8)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="aspect-[4/5] w-full rounded-lg border bg-muted object-contain" loading="lazy" decoding="async"
        src={`/api/content-production?image=${encodeURIComponent(setId)}&slide=${index}`} alt={`레퍼런스 ${index + 1}번 슬라이드`} />
      <span className="mt-1 block text-center text-xs text-muted-foreground [@media(max-height:450px)]:hidden">{index + 1}</span>
    </div>)}
  </div>;
}
