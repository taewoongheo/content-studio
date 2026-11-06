"use client";
import { useState } from "react";
import type { Row } from "@/domains/content-production/domain/contracts";
import { ReferenceCard } from "./reference-card";
export function ExternalLibrary({ posts, accounts }: { posts: Row[]; accounts: Row[] }) {
  const [query,setQuery]=useState(""),[type,setType]=useState("");
  const types=[...new Set(posts.map(post=>String(post.content_type??"")).filter(Boolean))];
  const rows=posts.filter(post=>(!type||post.content_type===type)&&[post.caption,post.title,post.topic,post.message,post.content_type,post.account].some(value=>String(value??"").toLowerCase().includes(query.toLowerCase())));
  return <div className="mt-5 space-y-5">
    <p className="text-xs text-muted-foreground">{accounts.length}개 스파이 계정 · 계정 관리와 전체 갱신은 대시보드의 외부 레퍼런스 스파이에서 할 수 있습니다.</p>
    <div className="flex flex-wrap gap-2">
      <input className="production-field !w-auto min-w-0 flex-1" aria-label="외부 레퍼런스 검색" placeholder="소재·메시지·포맷·계정 검색" value={query} onChange={e=>setQuery(e.target.value)} />
      <select className="production-field !w-auto" aria-label="외부 레퍼런스 포맷" value={type} onChange={e=>setType(e.target.value)}><option value="">모든 포맷</option>{types.map(value=><option key={value}>{value}</option>)}</select>
    </div>
    <div className="space-y-4">{rows.map(post=><ReferenceCard key={String(post.id)} post={post} />)}</div>
    {!rows.length&&<p className="text-sm text-muted-foreground">조건에 맞는 외부 레퍼런스가 없습니다.</p>}
  </div>;
}
