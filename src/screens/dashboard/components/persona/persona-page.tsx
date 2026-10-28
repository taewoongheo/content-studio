"use client";

import { personaSections, type PersonaContent } from "@/domains/content-production/domain/persona/model";
import { usePersona } from "./use-persona";

const fieldClass = "w-full rounded-lg border bg-background px-3 py-2 text-sm disabled:opacity-60";
const buttonClass = "rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50";

type Section = (typeof personaSections)[number];
const writingIds = new Set(["titles", "sentences", "development", "endings", "relationship", "personality"]);
function PersonaSection({ section, content, busy, onChange }: {
  section: Section; content: PersonaContent; busy: boolean; onChange: (section: string, key: string, value: string) => void;
}) {
  return <details className="rounded-xl border" open={section.id === "profile"}>
    <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">{section.label.replace("글쓰기 스타일 · ", "")}</summary>
    <div className="grid gap-5 border-t p-5">{Object.entries(section.fields).map(([key, label]) => <label key={key} className="space-y-2 text-sm font-medium">{label}
      <textarea value={content[section.id]?.[key] ?? ""} disabled={busy} maxLength={12000} rows={5} onChange={event => onChange(section.id, key, event.target.value)} className={`${fieldClass} resize-y font-normal leading-relaxed`} />
    </label>)}</div>
  </details>;
}

export function PersonaPage() {
  const { data, draft, handle, setHandle, error, busy, saved, dirty, update, save, analyze } = usePersona();
  function section(section: Section) {
    return <PersonaSection key={section.id} section={section} content={draft!.content} busy={busy} onChange={(id, key, value) => update({ content: { ...draft!.content, [id]: { ...draft!.content[id], [key]: value } } })} />;
  }
  return <div className="space-y-7">
    <header className="space-y-2">
      <p className="text-xs font-medium tracking-widest text-muted-foreground">CONTENT STUDIO</p>
      <h1 className="text-3xl font-semibold tracking-tight">페르소나</h1>
      <p className="text-sm text-muted-foreground">계정의 텍스트 표현 방식을 분석하고, 제작에 사용할 페르소나 한 개를 관리합니다.</p>
    </header>
    <section className="space-y-4 rounded-xl border p-5" aria-label="계정 분석">
      <form onSubmit={event => { event.preventDefault(); analyze(); }} className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-2 text-sm font-medium">TikTok 계정
          <input value={handle} onChange={event => setHandle(event.target.value)} placeholder="@계정 핸들 또는 TikTok 프로필 URL" required disabled={busy || !data} className={fieldClass} />
        </label>
        <button disabled={busy || !data || !handle.trim()} className={`${buttonClass} bg-foreground text-background`}>{busy ? "처리 중…" : draft ? "재분석" : "계정 분석"}</button>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">TikTok 인기순 슬라이드쇼 5개와, 중복을 제외한 최신 슬라이드쇼 5개를 분석합니다. 부족하면 각 정렬의 후보를 최대 100개까지 늘려 조회합니다. 전체 슬라이드 이미지와 캡션을 확인합니다.</p>
      {draft && <p className="text-xs text-muted-foreground">재분석 완료 시 직접 수정한 내용과 설정도 모두 교체됩니다.</p>}
      {data?.job.state === "running" && <p role="status" className="text-sm">{data.job.message}</p>}
      {data?.job.error && <p role="alert" className="text-sm text-destructive">{data.job.error}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    {!data && !error && <p role="status" className="text-sm text-muted-foreground">페르소나 불러오는 중…</p>}
    {data && !draft && !busy && <div className="rounded-xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">TikTok 계정을 분석하면 페르소나가 여기에 표시됩니다.</div>}
    {draft && <>
      <section className="space-y-5 rounded-xl border p-5" aria-label="페르소나 설정">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">@{draft.handle}</h2><p className="mt-1 text-xs text-muted-foreground">분석 {draft.analyzed_posts}개 · {new Date(draft.analyzed_at).toLocaleString("ko-KR")} · 수정 {new Date(draft.updated_at).toLocaleString("ko-KR")}</p></div>
          <div className="flex items-center gap-3"><span role="status" className="text-xs text-muted-foreground">{dirty ? "미저장 변경" : saved ? "저장 완료" : "저장됨"}</span><button onClick={save} disabled={busy || !dirty} className={`${buttonClass} bg-foreground text-background`}>변경 저장</button></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">페르소나 명칭<input value={draft.name} maxLength={120} disabled={busy} onChange={event => update({ name: event.target.value })} className={fieldClass} /></label>
          <label className="space-y-2 text-sm">생성될 게시물 언어<select value={draft.output_language} disabled={busy} onChange={event => update({ output_language: event.target.value })} className={fieldClass}><option>English</option></select></label>
        </div>
        <p className="text-xs text-muted-foreground">저장된 페르소나는 다음에 시작·재개하는 작업의 모든 제작 단계에 전달됩니다. 페르소나 분석 결과는 한국어로, 생성될 게시물은 영어로 운영합니다.</p>
      </section>
      <div className="space-y-3">
        {personaSections.filter(item => ["profile", "audience", "hook"].includes(item.id)).map(section)}
        <details className="rounded-xl border"><summary className="cursor-pointer px-5 py-4 text-sm font-semibold">글쓰기 스타일</summary><div className="space-y-3 border-t p-5">{personaSections.filter(item => writingIds.has(item.id)).map(section)}</div></details>
        {personaSections.filter(item => ["cta", "links", "instructions"].includes(item.id)).map(section)}
      </div>
      <footer className="flex items-center justify-end gap-3 border-t pt-5" aria-label="페르소나 저장">
        <span role="status" className="text-sm text-muted-foreground">{dirty ? "미저장 변경" : saved ? "저장 완료" : "저장됨"}</span>
        <button onClick={save} disabled={busy || !dirty} className={`${buttonClass} bg-foreground text-background`}>변경 저장</button>
      </footer>
    </>}
  </div>;
}
