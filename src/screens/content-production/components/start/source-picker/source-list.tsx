"use client";
import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import type { SavedPreviewResources } from "@/domains/slideshow/client/components/saved-preview-resources";

const Cover = dynamic(() => import("@/domains/slideshow/client/components/saved-slideshow-preview").then(module => module.SavedSlideshowPreview), { ssr: false });
const PAGE_SIZE = 8;
export function SourceList({ posts, value, onChange, resources }: {
  posts: PublishedPost[]; value: string; onChange: (id: string) => void; resources: SavedPreviewResources;
}) {
  const [count, setCount] = useState(PAGE_SIZE);
  const root = useRef<HTMLDivElement>(null), sentinel = useRef<HTMLDivElement>(null);
  const group = useId();
  const hasMore = count < posts.length;
  useEffect(() => {
    if (!root.current || !sentinel.current || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setCount(current => Math.min(current + PAGE_SIZE, posts.length));
    }, { root: root.current, rootMargin: "160px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [count, hasMore, posts.length]);
  return <div ref={root} role="radiogroup" aria-labelledby="source-list-label" className="max-h-80 overflow-y-auto overscroll-contain rounded-lg border">
    {posts.slice(0, count).map(post => {
      const id = `${group}-${post.id}`;
      return <div key={`${post.id}:${post.updatedAt}`} className="border-b last:border-b-0">
        <input id={id} className="peer sr-only" type="radio" name={group} aria-label={post.name} checked={value === post.id} onChange={() => onChange(post.id)} />
        <label htmlFor={id} className={`flex cursor-pointer gap-3 p-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-ring ${value === post.id ? "bg-muted ring-1 ring-inset ring-foreground" : "hover:bg-muted/50"}`}>
          <div aria-hidden="true" className="w-[88px] shrink-0"><Cover project={post} cover resources={resources} /></div>
          <span className="min-w-0 flex-1 py-1"><span className="block break-words text-sm font-medium">{post.name}</span>
            {post.topic && <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{post.topic}</span>}
            <span className="mt-2 block text-xs text-muted-foreground">{post.publishedOn} · {post.slideCount}장</span>
            {post.content_type && <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{post.content_type}</span>}
            {value === post.id && <span className="mt-2 block text-xs font-medium">선택됨</span>}
          </span>
        </label>
      </div>;
    })}
    {hasMore && <div ref={sentinel} className="p-3 text-center text-xs text-muted-foreground"><button type="button" onClick={() => setCount(current => current + PAGE_SIZE)}>게시글 더 보기</button></div>}
  </div>;
}
