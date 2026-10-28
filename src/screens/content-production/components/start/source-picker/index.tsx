"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { createSavedPreviewResources } from "@/domains/slideshow/client/components/saved-preview-resources";
import { SourceList } from "./source-list";

export const SourcePreview = dynamic(() => import("@/domains/slideshow/client/components/saved-slideshow-preview").then(module => module.SavedSlideshowPreview), {
  loading: () => <p className="py-4 text-xs text-muted-foreground">미리보기 불러오는 중…</p>, ssr: false,
});
export function SourcePicker({ posts, value, onChange }: {
  posts: PublishedPost[]; value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [resources] = useState(createSavedPreviewResources);
  useEffect(() => () => resources.clear(), [resources]);
  const selected = posts.find(post => post.id === value);
  const term = query.trim().toLowerCase();
  const filtered = posts.filter(post => `${post.name} ${post.topic} ${post.message} ${post.content_type}`.toLowerCase().includes(term));
  return <div className="space-y-3">
    <label className="block text-xs font-medium" htmlFor="source-search">과거 게시글 검색</label>
    <input id="source-search" className="production-field" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목·소재·포맷으로 검색" />
    <div className="flex items-center justify-between gap-2 text-xs"><span id="source-list-label" className="font-medium">원본 게시글</span><span className="text-muted-foreground">{filtered.length}개</span></div>
    <SourceList key={term} posts={filtered} value={value} onChange={onChange} resources={resources} />
    {!posts.length && <p className="text-xs text-muted-foreground">선택할 수 있는 게시된 콘텐츠가 없습니다.</p>}
    {!!posts.length && !filtered.length && <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>}
    {selected && <div className="min-w-0 rounded-lg border p-3">
      <p className="text-xs font-medium">선택한 게시글: {selected.name}</p>
      <p className="mt-1 text-xs text-muted-foreground">{selected.content_type || "원본 구성"} · {selected.slideCount}장</p>
      <SourcePreview key={`${selected.id}:${selected.updatedAt}`} project={selected} resources={resources} />
    </div>}
  </div>;
}
