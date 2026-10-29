"use client";
import { useState } from "react";
import type { Row } from "@/domains/content-production/domain/contracts";
import { SourceList } from "./source-list";

export function ReferencePicker({ posts, value, onChange }: {
  posts: Row[]; value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState("");
  const [slide, setSlide] = useState(0);
  const term = query.trim().toLowerCase();
  const selected = posts.find(post => post.id === value);
  const filtered = posts.filter(post => (!account || post.account === account) &&
    [post.title, post.caption, post.topic, post.content_type, post.account].some(v => String(v ?? "").toLowerCase().includes(term)))
    .sort((a, b) => String(b.published_at ?? "").localeCompare(String(a.published_at ?? "")));
  const list = filtered.map(post => ({ id: String(post.id), name: String(post.title || post.caption || "캡션 없음"),
    topic: `@${post.account}`, content_type: String(post.content_type ?? ""), updatedAt: String(post.observed_at ?? ""),
    publishedOn: post.published_at ? new Date(String(post.published_at)).toLocaleDateString("ko-KR") : "게시일 미상", slideCount: Number(post.slide_count) || 0 }));
  const change = (id: string) => { setSlide(0); onChange(id); };
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex shrink-0 gap-2">
      <input className="production-field min-w-0 flex-1" aria-label="레퍼런스 게시글 검색" type="search" placeholder="캡션·주제·계정 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <select className="production-field !w-auto max-w-40" aria-label="레퍼런스 계정" value={account} onChange={e => setAccount(e.target.value)}>
        <option value="">모든 계정</option>{[...new Set(posts.map(post => String(post.account)))].map(name => <option key={name} value={name}>@{name}</option>)}
      </select>
    </div>
    <span id="source-list-label" className="sr-only">레퍼런스 원본 게시글</span>
    <SourceList key={`${term}:${account}`} posts={list} value={value} onChange={change} />
    {!filtered.length && <p className="text-xs text-muted-foreground">선택할 슬라이드쇼가 없습니다. 스파이 계정의 수집 게시글과 제외 상태를 확인해 주세요.</p>}
    {selected && <div className="shrink-0 rounded-lg border p-2 text-xs">
      <p className="truncate font-medium">선택한 게시글: {String(selected.title || selected.caption || "캡션 없음")}</p>
      <a href={String(selected.url)} target="_blank" rel="noreferrer" className="underline">@{String(selected.account)} 원본 보기 ↗</a>
      {selected.visual_set_id ? <div className="flex items-center justify-center gap-3 pt-2">
        <button type="button" className="production-button" aria-label="이전 레퍼런스 이미지" disabled={slide === 0} onClick={() => setSlide(n => n - 1)}>이전</button>
        {/* Stored, bounded thumbnails only; browsing never starts an Apify run. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="h-[clamp(48px,18dvh,180px)] max-w-[50%] object-contain" src={`/api/content-production?image=${encodeURIComponent(String(selected.visual_set_id))}&slide=${slide}`} alt={`선택한 레퍼런스 ${slide + 1}장`} />
        <button type="button" className="production-button" aria-label="다음 레퍼런스 이미지" disabled={slide + 1 >= Number(selected.slide_count)} onClick={() => setSlide(n => n + 1)}>다음</button>
      </div> : <p className="mt-2 text-muted-foreground">제작 시작 시 선택한 게시글의 전체 이미지를 확보합니다.</p>}
    </div>}
  </div>;
}
