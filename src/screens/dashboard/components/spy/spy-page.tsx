"use client";
import { useState } from "react";
import { SpyPosts } from "./spy-posts";
import { useSpy } from "./use-spy";
const date=(value:unknown)=>value?new Date(String(value)).toLocaleString("ko-KR"):"—";
export function SpyPage() {
  const {data,error,busy,act}=useSpy();
  const [account,setAccount]=useState("");
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
    <SpyPosts posts={data?.externalReferences ?? []} busy={busy} onExclude={(id,excluded)=>void act({action:"exclude_reference",id,excluded})} />
  </div>;
}
