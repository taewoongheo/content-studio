"use client";
import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { productionModeLabels, productionRequestSchema, type ProductionRequest } from "@/domains/content-production/domain/start/input";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { SourcePicker } from "./source-picker";

const descriptions: Record<ProductionRequest["mode"], string> = {
  automatic: "과거 콘텐츠와 레퍼런스를 분석해 주제와 구성을 정합니다.",
  past_post: "원본의 구성과 표현 방식을 유지하고 새로운 주제로 만듭니다.",
  external_url: "외부 게시글의 주제를 우리 콘텐츠의 스타일로 만듭니다.",
};
export function RequestDialog({ initial, posts, onClose, onSave }: {
  initial?: ProductionRequest; posts: PublishedPost[]; onClose: () => void; onSave: (request: ProductionRequest) => void;
}) {
  const [mode, setMode] = useState<ProductionRequest["mode"]>(initial?.mode ?? "automatic");
  const [sourceProjectId, setSource] = useState(initial?.mode === "past_post" ? initial.sourceProjectId : "");
  const [url, setUrl] = useState(initial?.mode === "external_url" ? initial.url : "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = productionRequestSchema.safeParse({ mode, sourceProjectId, url, instructions });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (mode === "past_post" && !posts.some(post => post.id === sourceProjectId)) {
      setError("원본 게시글을 선택해 주세요."); return;
    }
    onSave(parsed.data);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{initial ? "제작 요청 수정" : "제작 요청 추가"}</DialogTitle>
        <DialogDescription>시작 방식을 선택하고 필요한 지침을 입력하세요.</DialogDescription></DialogHeader>
      <form className="min-w-0 space-y-5" onSubmit={submit}>
        <fieldset className="grid gap-2 sm:grid-cols-3">
          <legend className="sr-only">생성 방식</legend>
          {(Object.keys(productionModeLabels) as ProductionRequest["mode"][]).map(value =>
            <label key={value} className={`cursor-pointer rounded-lg border p-3 ${mode === value ? "border-foreground bg-muted" : "hover:bg-muted/50"}`}>
              <span className="flex items-center gap-2 text-sm font-medium"><input type="radio" aria-label={productionModeLabels[value]} name="production-mode" value={value} checked={mode === value} onChange={() => { setMode(value); setError(""); }} />{productionModeLabels[value]}</span>
              <span className="mt-2 block text-xs leading-5 text-muted-foreground">{descriptions[value]}</span>
            </label>)}
        </fieldset>
        {mode === "past_post" && <SourcePicker posts={posts} value={sourceProjectId} onChange={value => { setSource(value); setError(""); }} />}
        {mode === "external_url" && <div className="space-y-2">
          <label htmlFor="production-source-url" className="block text-xs font-medium">TikTok 슬라이드쇼 URL</label>
          <input id="production-source-url" className="production-field" type="url" value={url} onChange={event => { setUrl(event.target.value); setError(""); }} required placeholder="https://www.tiktok.com/@.../photo/..." />
          <p className="text-xs text-muted-foreground">게시글의 전체 URL을 입력하세요. 시작 후 캡션과 전체 슬라이드를 가져옵니다.</p>
        </div>}
        <div className="space-y-2">
          <label htmlFor="production-instructions" className="block text-xs font-medium">추가 지침 <span className="font-normal text-muted-foreground">선택</span></label>
          <textarea id="production-instructions" className="production-field min-h-28 resize-y" value={instructions} onChange={event => { setInstructions(event.target.value); setError(""); }} maxLength={10000} placeholder={mode === "past_post" ? "예: 가슴 운동으로 바꾸고 덤벨만 사용해 줘" : "예: 홈트 초보자를 대상으로 만들어 줘"} />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="production-button" onClick={onClose}>취소</button>
          <button className="production-button primary">{initial ? "수정" : "추가"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
