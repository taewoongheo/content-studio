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
    <DialogContent className={`flex max-h-[calc(100dvh-2rem)] flex-col gap-2 overflow-hidden p-3 sm:max-w-2xl [@media(max-height:450px)]:gap-1 [@media(max-height:450px)]:p-2 ${mode === "past_post" ? "h-[min(850px,calc(100dvh-2rem))]" : ""}`}>
      <DialogHeader className="shrink-0 gap-1"><DialogTitle>{initial ? "제작 요청 수정" : "제작 요청 추가"}</DialogTitle>
        <DialogDescription className="[@media(max-height:650px)]:hidden">시작 방식을 선택하고 필요한 지침을 입력하세요.</DialogDescription></DialogHeader>
      <form className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 [@media(max-height:450px)]:gap-1" onSubmit={submit}>
        <div className="shrink-0 space-y-2">
        <fieldset className="grid grid-cols-3 gap-2">
          <legend className="sr-only">생성 방식</legend>
          {(Object.keys(productionModeLabels) as ProductionRequest["mode"][]).map(value =>
            <label key={value} className={`min-w-0 cursor-pointer rounded-lg border p-2 ${mode === value ? "border-foreground bg-muted" : "hover:bg-muted/50"}`}>
              <span className="flex items-center gap-2 whitespace-nowrap text-xs font-medium sm:text-sm"><input type="radio" aria-label={productionModeLabels[value]} name="production-mode" value={value} checked={mode === value} onChange={() => { setMode(value); setError(""); }} />{productionModeLabels[value]}</span>
            </label>)}
        </fieldset>
        <p className="text-xs leading-5 text-muted-foreground [@media(max-height:650px)]:hidden">{descriptions[mode]}</p>
        </div>
        {mode === "past_post" && <SourcePicker posts={posts} value={sourceProjectId} onChange={value => { setSource(value); setError(""); }} />}
        {mode === "external_url" && <div className="space-y-2">
          <label htmlFor="production-source-url" className="block text-xs font-medium">TikTok 슬라이드쇼 URL</label>
          <input id="production-source-url" className="production-field" type="url" value={url} onChange={event => { setUrl(event.target.value); setError(""); }} required placeholder="https://www.tiktok.com/@.../photo/..." />
          <p className="text-xs text-muted-foreground">게시글의 전체 URL을 입력하세요. 시작 후 캡션과 전체 슬라이드를 가져옵니다.</p>
        </div>}
        <div className="shrink-0 space-y-1">
          <label htmlFor="production-instructions" className="block text-xs font-medium">추가 지침 <span className="font-normal text-muted-foreground">선택</span></label>
          <textarea id="production-instructions" className="production-field h-[clamp(40px,8dvh,72px)] min-h-0 resize-none" value={instructions} onChange={event => { setInstructions(event.target.value); setError(""); }} maxLength={10000} placeholder={mode === "past_post" ? "예: 가슴 운동으로 바꾸고 덤벨만 사용해 줘" : "예: 홈트 초보자를 대상으로 만들어 줘"} />
        </div>
        {error && <p role="alert" className="shrink-0 text-xs text-destructive">{error}</p>}
        <div className="flex shrink-0 justify-end gap-2"><button type="button" className="production-button" onClick={onClose}>취소</button>
          <button className="production-button primary">{initial ? "수정" : "추가"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
