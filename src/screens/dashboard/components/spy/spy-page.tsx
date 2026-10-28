"use client";
import { useState } from "react";
import { useSpy } from "./use-spy";
const number=(value:unknown)=>typeof value==="number"?value.toLocaleString():"—";
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString("ko-KR"):"—";
export function SpyPage() {
  const {data,error,busy,act}=useSpy();
  const [account,setAccount]=useState(""),[query,setQuery]=useState(""),[filter,setFilter]=useState(""),[page,setPage]=useState(0);
  const rows=(data?.externalReferences??[]).filter(post=>(!filter||post.account===filter)&&[post.caption,post.topic,post.message,post.account].some(value=>String(value??"").toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>String(b.published_at??"").localeCompare(String(a.published_at??"")));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(rows.length/20)-1));
  return <div className="space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">외부 레퍼런스 스파이</h1><p className="mt-2 text-sm text-muted-foreground">등록한 계정의 게시글과 성과를 모아 제작에 참고합니다.</p></div>
      <button className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50" disabled={busy||!data?.referenceAccounts.length} onClick={()=>void act({action:"refresh_spy"})}>{busy?"갱신 중…":"전체 갱신"}</button></header>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <section className="rounded-xl border p-5" aria-label="스파이 계정">
      <form className="flex gap-2" onSubmit={e=>{e.preventDefault();void act({action:"reference_account",account}).then(ok=>{if(ok)setAccount("");});}}>
        <input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" aria-label="스파이 TikTok 계정" placeholder="@아이디 또는 TikTok 프로필 URL" value={account} onChange={e=>setAccount(e.target.value)} required disabled={busy}/>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={busy}>계정 등록</button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">최초 최대 100개를 저장합니다. 이후 갱신은 모든 계정의 최신 게시글부터 확인합니다.</p>
      <ul className="mt-4 divide-y">{data?.referenceAccounts.map(row=>{const name=String(row.username),status=data.spy.accounts[name];return <li key={name} className="flex flex-wrap items-center gap-3 py-3">
        <a className="font-medium underline" href={String(row.url)} target="_blank" rel="noreferrer">@{name}</a>
        <span className="flex-1 text-xs text-muted-foreground">{status?.state==="running"?"확인 중…":status?.state==="failed"?status.error:status?.state==="completed"?`새 게시글 ${status.count}개 · ${date(row.last_fetched_at)}`:`마지막 확인 ${date(row.last_fetched_at)}`}</span>
        <button className="rounded border px-3 py-1 text-xs disabled:opacity-50" disabled={busy} onClick={()=>void act({action:"remove_reference_account",username:name})}>삭제</button>
      </li>;})}</ul>
      {!data?.referenceAccounts.length&&<p className="mt-4 text-sm text-muted-foreground">참고할 TikTok 계정을 등록해 주세요.</p>}
    </section>
    <section className="space-y-4" aria-label="수집 게시글">
      <div className="flex flex-wrap gap-3"><input className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" aria-label="스파이 게시글 검색" placeholder="캡션·주제·계정 검색" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
        <select className="rounded-lg border px-3 py-2 text-sm" aria-label="스파이 계정 필터" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}><option value="">모든 계정</option>{[...new Set((data?.externalReferences??[]).map(row=>String(row.account)))].map(name=><option key={name} value={name}>@{name}</option>)}</select></div>
      <p className="text-xs text-muted-foreground">{rows.length}개 게시글 · 성과는 마지막 관측 시점 기준입니다. 이미지는 제작에서 필요할 때 확보합니다.</p>
      <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>{['게시일','계정','종류','내용','조회수','좋아요','댓글','저장','공유','반응률','관측일','제작 참고'].map(label=><th className="whitespace-nowrap p-3 font-medium" key={label}>{label}</th>)}</tr></thead>
        <tbody>{rows.slice(currentPage*20,currentPage*20+20).map(post=><tr key={String(post.id)} className="border-t align-top">
          <td className="whitespace-nowrap p-3 text-xs">{date(post.published_at)}</td><td className="p-3">@{String(post.account)}</td><td className="whitespace-nowrap p-3">{Number(post.slide_count)>0?"슬라이드쇼":"영상/기타"}</td>
          <td className="min-w-64 max-w-96 p-3"><a className="text-xs underline" href={String(post.url)} target="_blank" rel="noreferrer">원본 보기 ↗</a><details className="mt-2"><summary className="cursor-pointer break-words">{String(post.caption).slice(0,100)||"캡션 없음"}</summary><p className="mt-2 whitespace-pre-wrap break-words">{String(post.caption)}</p></details>{!!post.topic&&<p className="mt-2 text-xs text-muted-foreground">{String(post.topic)}</p>}</td>
          {['view_count','like_count','comment_count','save_count','share_count'].map(key=><td key={key} className="p-3 tabular-nums">{number(post[key])}</td>)}
          <td className="p-3">{typeof post.engagement_rate==="number"?`${(post.engagement_rate*100).toFixed(2)}%`:"—"}</td><td className="whitespace-nowrap p-3 text-xs">{date(post.observed_at)}</td>
          <td className="p-3"><button className="whitespace-nowrap rounded border px-2 py-1 text-xs" disabled={busy} onClick={()=>void act({action:"exclude_reference",id:post.id,excluded:!post.excluded})}>{post.excluded?"제외됨 · 복원":"포함 · 제외"}</button></td>
        </tr>)}</tbody></table></div>
      {!rows.length&&<p className="text-sm text-muted-foreground">저장된 게시글이 없습니다.</p>}
      <div className="flex items-center justify-end gap-3 text-sm"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전</button><span>{currentPage+1} / {Math.max(1,Math.ceil(rows.length/20))}</span><button disabled={(currentPage+1)*20>=rows.length} onClick={()=>setPage(currentPage+1)}>다음</button></div>
    </section>
  </div>;
}
