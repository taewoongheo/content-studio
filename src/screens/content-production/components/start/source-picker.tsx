"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";

const Preview = dynamic(() => import("@/domains/slideshow/client/components/saved-slideshow-preview").then(module => module.SavedSlideshowPreview), {
  loading: () => <p className="py-4 text-xs text-muted-foreground">미리보기 불러오는 중…</p>, ssr: false,
});
export function SourcePicker({ posts, value, onChange }: {
  posts: PublishedPost[]; value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selected = posts.find(post => post.id === value);
  const filtered = posts.filter(post => `${post.name} ${post.topic} ${post.content_type}`.toLowerCase().includes(query.toLowerCase()));
  const options = selected && !filtered.some(post => post.id === value) ? [selected, ...filtered] : filtered;
  return <div className="space-y-3">
    <label className="block text-xs font-medium" htmlFor="source-search">과거 게시글 검색</label>
    <input id="source-search" className="production-field" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목·소재·포맷으로 검색" />
    <label className="block text-xs font-medium" htmlFor="source-project">원본 게시글</label>
    <select id="source-project" className="production-field" value={value} onChange={event => onChange(event.target.value)} required>
      <option value="">게시글을 선택하세요</option>
      {options.map(post => <option key={post.id} value={post.id}>{post.name} · {post.publishedOn}</option>)}
    </select>
    {!posts.length && <p className="text-xs text-muted-foreground">선택할 수 있는 게시된 콘텐츠가 없습니다.</p>}
    {!!posts.length && !filtered.length && <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>}
    {selected && <div className="min-w-0 rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{selected.content_type || "원본 구성"} · {selected.slideCount}장</p>
      <Preview key={selected.id} project={selected} />
    </div>}
  </div>;
}
