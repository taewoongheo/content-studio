"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { createSavedPreviewResources } from "@/domains/slideshow/client/components/saved-preview-resources";
import { SourceList } from "./source-list";

const SourcePreview = dynamic(() => import("@/domains/slideshow/client/components/saved-slideshow-preview").then(module => module.SavedSlideshowPreview), {
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
  return <div className="flex min-h-0 flex-1 flex-col gap-2 [@media(max-height:450px)]:gap-1">
    <label className="sr-only" htmlFor="source-search">과거 게시글 검색</label>
    <div className="flex shrink-0 items-center gap-2">
      <input id="source-search" className="production-field min-w-0 flex-1" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="제목·소재·포맷으로 검색" />
      <span id="source-list-label" className="sr-only">원본 게시글</span><span className="shrink-0 text-xs text-muted-foreground">{filtered.length}개</span>
    </div>
    <SourceList key={term} posts={filtered} value={value} onChange={onChange} />
    {!posts.length && <p className="text-xs text-muted-foreground">선택할 수 있는 게시된 콘텐츠가 없습니다.</p>}
    {!!posts.length && !filtered.length && <p className="text-xs text-muted-foreground">검색 결과가 없습니다.</p>}
    {selected && <div className="min-w-0 shrink-0 rounded-lg border p-2 [@media(max-height:450px)]:p-1">
      <p className="truncate text-xs font-medium">선택한 게시글: {selected.name}</p>
      <SourcePreview key={`${selected.id}:${selected.updatedAt}`} project={selected} compact resources={resources} />
    </div>}
  </div>;
}
