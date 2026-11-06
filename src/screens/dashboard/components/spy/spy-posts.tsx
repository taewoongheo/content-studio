"use client";
import { useState } from "react";
import type { Row } from "@/domains/content-production/domain/contracts";
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString("ko-KR"):"—";
export function SpyPosts({posts}:{posts:Row[]}) {
  const [query,setQuery]=useState(""),[filter,setFilter]=useState(""),[page,setPage]=useState(0);
  const rows=posts.filter(post=>(!filter||post.account===filter)&&[post.caption,post.topic,post.message,post.account].some(value=>String(value??"").toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>String(b.published_at??"").localeCompare(String(a.published_at??"")));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  return (    <section className="space-y-4" aria-label="수집 게시글">
      <div className="flex flex-wrap gap-3"><input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" aria-label="스파이 게시글 검색" placeholder="캡션·주제·계정 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
        <select className="rounded-lg border px-3 py-2 text-sm" aria-label="스파이 계정 필터" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="">모든 계정</option>{[...new Set(posts.map(row=>String(row.account)))].map(name=><option key={name} value={name}>@{name}</option>)}</select></div>
      <p className="text-xs text-muted-foreground">{rows.length}개 게시글 · 주제 패턴을 찾는 참고 자료입니다. 이미지는 제작에서 필요할 때 확보합니다.</p>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['게시일','계정','종류','내용','수집일'].map(label=><th className="whitespace-nowrap p-3 font-medium" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice(currentPage*20,currentPage*20+20).map(post=><tr key={String(post.id)} className="border-t align-top">
          <td className="whitespace-nowrap p-3 text-xs">{date(post.published_at)}</td><td className="p-3">@{String(post.account)}</td><td className="whitespace-nowrap p-3">{Number(post.slide_count)>0?"슬라이드쇼":"영상/기타"}</td>
          <td className="min-w-64 max-w-96 p-3"><a className="text-xs underline" href={String(post.url)} target="_blank" rel="noreferrer">원본 보기 ↗</a><details className="mt-2"><summary className="cursor-pointer break-words">{String(post.caption).slice(0,100)||"캡션 없음"}</summary><p className="mt-2 whitespace-pre-wrap break-words">{String(post.caption)}</p></details>{!!post.topic&&<p className="mt-2 text-xs text-muted-foreground">{String(post.topic)}</p>}</td>
          <td className="whitespace-nowrap p-3 text-xs">{date(post.observed_at)}</td>
        </tr>)}</tbody></table></div>
      {!rows.length&&<p className="text-sm text-muted-foreground">저장된 게시글이 없습니다.</p>}
      <div className="flex items-center justify-end gap-3 text-sm"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage+1} / {Math.max(1,Math.ceil(rows.length/20))}</span><button disabled={(currentPage+1)*20>=rows.length} onClick={()=>setPage(currentPage+1)}>다음</button></div>
    </section>);
}
