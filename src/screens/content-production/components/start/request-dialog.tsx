"use client";
import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { preservesSourceFormat, productionRequestSchema, type ProductionRequest } from "@/domains/content-production/domain/start/input";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import type { Row } from "@/domains/content-production/domain/contracts";
import { ReferencePicker } from "./source-picker/reference-picker";
import { SourcePicker } from "./source-picker";

const startModes = [
  { value: "automatic", label: "자동 생성" },
  { value: "reference", label: "레퍼런스 기반" },
  { value: "external_url", label: "외부 URL" },
] as const;
const referenceModes = [
  { value: "past_post", label: "내 게시글" },
  { value: "spy_reference", label: "스파이 게시글" },
] as const;

const descriptions: Record<ProductionRequest["mode"], string> = {
  spy_reference: "선택한 스파이 게시글의 구성과 표현 방식을 유지하고 새로운 주제로 만듭니다.",
  automatic: "과거 콘텐츠와 레퍼런스를 분석해 주제와 구성을 정합니다.",
  past_post: "원본의 구성과 표현 방식을 유지하고 새로운 주제로 만듭니다.",
  external_url: "외부 게시글의 주제를 우리 콘텐츠의 스타일로 만듭니다.",
};
export function RequestDialog({ initial, posts, references, onClose, onSave }: {
  initial?: ProductionRequest; posts: PublishedPost[]; references: Row[]; onClose: () => void; onSave: (request: ProductionRequest) => void;
}) {
  const [mode, setMode] = useState<ProductionRequest["mode"]>(initial?.mode ?? "automatic");
  const [referenceMode, setReferenceMode] = useState<"past_post" | "spy_reference">(initial?.mode === "spy_reference" ? "spy_reference" : "past_post");
  const isReference = preservesSourceFormat(mode);
  const startMode = isReference ? "reference" : mode;
  const [sourceProjectId, setSource] = useState(initial?.mode === "past_post" ? initial.sourceProjectId : "");
  const [referenceId, setReference] = useState(initial?.mode === "spy_reference" ? initial.referenceId : "");
  const [url, setUrl] = useState(initial?.mode === "external_url" ? initial.url : "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = productionRequestSchema.safeParse({ mode, sourceProjectId, referenceId, url, instructions });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (mode === "past_post" && !posts.some(post => post.id === sourceProjectId)) {
      setError("원본 게시글을 선택해 주세요."); return;
    }
    if (mode === "spy_reference" && !references.some(post => post.id === referenceId)) { setError("레퍼런스 게시글을 선택해 주세요."); return; }
    onSave(parsed.data);
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={`flex max-h-[calc(100dvh-2rem)] flex-col gap-2 overflow-hidden p-3 sm:max-w-2xl [@media(max-height:450px)]:gap-1 [@media(max-height:450px)]:p-2 ${isReference ? "h-[min(850px,calc(100dvh-2rem))]" : ""}`}>
      <DialogHeader className="shrink-0 gap-1"><DialogTitle>{initial ? "제작 요청 수정" : "제작 요청 추가"}</DialogTitle>
        <DialogDescription className="[@media(max-height:650px)]:hidden">시작 방식을 선택하고 필요한 지침을 입력하세요.</DialogDescription></DialogHeader>
      <form className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 [@media(max-height:450px)]:gap-1" onSubmit={submit}>
        <div className="shrink-0 space-y-2 [@media(max-height:450px)]:flex [@media(max-height:450px)]:gap-2 [@media(max-height:450px)]:space-y-0">
        <fieldset className="grid min-w-0 flex-1 grid-cols-3 gap-2 [@media(max-height:450px)]:flex-[1.3]">
          <legend className="sr-only">생성 방식</legend>
          {startModes.map(({ value, label }) =>
            <label key={value} className={`min-w-0 cursor-pointer rounded-lg border p-2 ${startMode === value ? "border-foreground bg-muted" : "hover:bg-muted/50"}`}>
              <span className="flex items-center gap-2 whitespace-nowrap text-xs font-medium sm:text-sm"><input type="radio" aria-label={label} name="production-mode" value={value} checked={startMode === value} onChange={() => { setMode(value === "reference" ? referenceMode : value); setError(""); }} />{label}</span>
            </label>)}
        </fieldset>
        {isReference && <fieldset className="flex min-w-0 flex-1 gap-1 rounded-lg bg-muted p-1">
          <legend className="sr-only">레퍼런스 출처</legend>
          {referenceModes.map(({ value, label }) => <label key={value} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs ${mode === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>
            <input type="radio" name="reference-mode" aria-label={label} checked={mode === value} onChange={() => { setReferenceMode(value); setMode(value); setError(""); }} />{label}
          </label>)}
        </fieldset>}
        <p className="text-xs leading-5 text-muted-foreground [@media(max-height:650px)]:hidden">{descriptions[mode]}</p>
        </div>
        {mode === "past_post" && <SourcePicker posts={posts} value={sourceProjectId} onChange={value => { setSource(value); setError(""); }} />}
        {mode === "spy_reference" && <ReferencePicker posts={references} value={referenceId} onChange={value => { setReference(value); setError(""); }} />}
        {mode === "external_url" && <div className="space-y-2">
          <label htmlFor="production-source-url" className="block text-xs font-medium">TikTok 슬라이드쇼 URL</label>
          <input id="production-source-url" className="production-field" type="url" value={url} onChange={event => { setUrl(event.target.value); setError(""); }} required placeholder="https://www.tiktok.com/@.../photo/..." />
          <p className="text-xs text-muted-foreground">게시글의 전체 URL을 입력하세요. 시작 후 캡션과 전체 슬라이드를 가져옵니다.</p>
        </div>}
        <div className="shrink-0 space-y-1">
          <label htmlFor="production-instructions" className="block text-xs font-medium">추가 지침 <span className="font-normal text-muted-foreground">선택</span></label>
          <textarea id="production-instructions" className="production-field h-[clamp(40px,8dvh,72px)] min-h-0 resize-none" value={instructions} onChange={event => { setInstructions(event.target.value); setError(""); }} maxLength={10000} placeholder={isReference ? "예: 가슴 운동으로 바꾸고 덤벨만 사용해 줘" : "예: 홈트 초보자를 대상으로 만들어 줘"} />
        </div>
        {error && <p role="alert" className="shrink-0 text-xs text-destructive">{error}</p>}
        <div className="flex shrink-0 justify-end gap-2"><button type="button" className="production-button" onClick={onClose}>취소</button>
          <button className="production-button primary">{initial ? "수정" : "추가"}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
