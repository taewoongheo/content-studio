"use client";
import { useState } from "react";
import type { Row } from "@/domains/content-production/domain/contracts";
import { ReferenceCard } from "./reference-card";
export function ExternalLibrary({ posts, accounts, act }: { posts: Row[]; accounts: Row[]; act: (input: Record<string,unknown>)=>Promise<unknown> }) {
  const [query,setQuery]=useState(""),[type,setType]=useState(""),[excluded,setExcluded]=useState(false),[error,setError]=useState(""),[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
  const safe = async (key: string, input: Record<string, unknown>) => {
    setError(""); setNotice(""); setBusy(key);
    try {
      const result = await act(input) as { collected?: number } | undefined;
      if (typeof result?.collected === "number")
        setNotice(`슬라이드쇼 ${result.collected}개를 확인했습니다.`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청 실패");
      return false;
    } finally { setBusy(""); }
  };
  const types=[...new Set(posts.map(post=>String(post.content_type??"")).filter(Boolean))];
  const rows=posts.filter(post=>(excluded||!post.excluded)&&(!type||post.content_type===type)&&[post.caption,post.title,post.topic,post.message,post.content_type,post.account].some(value=>String(value??"").toLowerCase().includes(query.toLowerCase())));
  return <div className="mt-5 space-y-5">
    <p className="text-xs text-muted-foreground">{accounts.length}개 스파이 계정 · 계정 관리와 전체 갱신은 대시보드의 외부 레퍼런스 스파이에서 할 수 있습니다.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice&&<p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <div className="flex flex-wrap gap-2">
      <input className="production-field !w-auto min-w-0 flex-1" aria-label="외부 레퍼런스 검색" placeholder="소재·메시지·포맷·계정 검색" value={query} onChange={e=>setQuery(e.target.value)} />
      <select className="production-field !w-auto" aria-label="외부 레퍼런스 포맷" value={type} onChange={e=>setType(e.target.value)}><option value="">모든 포맷</option>{types.map(value=><option key={value}>{value}</option>)}</select>
    </div>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={excluded} onChange={e=>setExcluded(e.target.checked)} />제외한 게시글 보기</label>
    <div className="space-y-4">{rows.map(post=><ReferenceCard key={String(post.id)} post={post} onExclude={value=>{if(busy)return;void safe(String(post.id),{action:"exclude_reference",id:post.id,excluded:value});}} />)}</div>
    {!rows.length&&<p className="text-sm text-muted-foreground">조건에 맞는 외부 레퍼런스가 없습니다.</p>}
  </div>;
}
