"use client";

import { productFields } from "@/domains/content-production/domain/product";
import { useProducts } from "./use-products";

const buttonClass = "rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50";
export function ProductsPage() {
  const { draft, busy, ready, error, message, dirty, save, update } = useProducts();
  return <div className="space-y-7">
    <header className="space-y-2"><p className="text-xs font-medium tracking-widest text-muted-foreground">CONTENT STUDIO</p><h1 className="text-3xl font-semibold tracking-tight">제품 관리</h1><p className="text-sm text-muted-foreground">콘텐츠 제작에 사용할 제품 정보를 작성합니다.</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {!ready && !error && <p role="status" className="text-sm text-muted-foreground">제품 불러오는 중…</p>}
    <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-5 rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">제품 정보</h2>{dirty && <span className="text-xs text-muted-foreground">미저장 변경</span>}</div>
      {Object.entries(productFields).map(([key, label]) => {
        const field = key as keyof typeof productFields;
        const className = "w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal disabled:opacity-60";
        return <label key={key} className="block space-y-2 text-sm font-medium">{label}{key === "name" ? " *" : ""}
          {key === "name" || key === "url" ? <input className={className} value={draft[field]} onChange={event => update(field, event.target.value)} required={key === "name"} type={key === "url" ? "url" : "text"} maxLength={key === "name" ? 120 : 4000} disabled={busy || !ready} /> : <textarea className={`${className} resize-y leading-relaxed`} rows={3} maxLength={key === "cta" ? 4000 : 12000} value={draft[field]} onChange={event => update(field, event.target.value)} disabled={busy || !ready} />}
        </label>;
      })}
      <p className="text-xs text-muted-foreground">저장된 제품 정보는 다음에 시작·재개하는 작업의 모든 제작 단계에 전달됩니다. 검증된 기능과 주장만 작성해 주세요.</p>
      <button disabled={busy || !ready || !dirty || !draft.name.trim()} className={`${buttonClass} bg-foreground text-background`}>{busy ? "저장 중…" : "제품 저장"}</button>
    </form>
  </div>;
}
