"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";

const PAGE_SIZE = 8;
export function SourceList({ posts, value, onChange }: {
  posts: PublishedPost[]; value: string; onChange: (id: string) => void;
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
  return <div ref={root} role="radiogroup" aria-labelledby="source-list-label" className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border">
    {posts.slice(0, count).map(post => {
      const id = `${group}-${post.id}`;
      return <div key={`${post.id}:${post.updatedAt}`} className="relative border-b last:border-b-0">
        <input id={id} className="peer sr-only" type="radio" name={group} aria-label={post.name} checked={value === post.id} onChange={() => onChange(post.id)} />
        <label htmlFor={id} className={`flex cursor-pointer gap-3 p-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:-outline-offset-2 peer-focus-visible:outline-ring ${value === post.id ? "bg-muted ring-1 ring-inset ring-foreground" : "hover:bg-muted/50"}`}>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{post.name}</span>
            {post.topic && <span className="mt-1 block truncate text-xs text-muted-foreground">{post.topic}</span>}
            <span className="mt-1 block text-xs text-muted-foreground">{post.publishedOn} · {post.slideCount}장</span>
            {post.content_type && <span className="mt-1 block truncate text-xs text-muted-foreground">{post.content_type}</span>}

          </span>
          {value === post.id && <span className="shrink-0 text-xs font-medium">선택됨</span>}
        </label>
      </div>;
    })}
    {hasMore && <div ref={sentinel} className="p-3 text-center text-xs text-muted-foreground"><button type="button" onClick={() => setCount(current => current + PAGE_SIZE)}>게시글 더 보기</button></div>}
  </div>;
}
