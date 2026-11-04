"use client";
import { useState } from "react";
import { samplingSchema, type SamplingSettings } from "@/domains/content-production/domain/references/sampling";
export function SamplingControls({value,onSave,disabled}:{value:SamplingSettings;onSave:(settings:SamplingSettings)=>Promise<unknown>;disabled:boolean}) {
  const [draft,setDraft]=useState(String(value.internalCandidates)),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const dirty=draft!==String(value.internalCandidates);
  return <fieldset disabled={disabled||busy} className="space-y-2 rounded-lg border p-3">
    <legend className="px-1 text-xs font-medium">성과 후보 수</legend>
    <label className="flex items-center justify-between gap-2 text-xs">내부 게시글<input className="production-field !w-20" aria-label="내부 게시글 성과 후보 수" type="number" min={5} max={1000} value={draft} onChange={e=>setDraft(e.target.value)} /></label>
    <p className="text-xs text-muted-foreground">내 게시글의 성과 상위 후보에서 무작위 5개 + 최근 5개. 다음 제작부터 적용합니다.</p>
    {dirty&&<button className="production-button" type="button" onClick={()=>void(async()=>{setError("");const parsed=samplingSchema.safeParse({internalCandidates:Number(draft)});if(!parsed.success){setError("5~1,000 사이의 정수를 입력해 주세요.");return;}setBusy(true);try{await onSave(parsed.data);}catch(e){setError(e instanceof Error?e.message:"저장 실패");}finally{setBusy(false);}})()}>{busy?"저장 중…":"후보 수 저장"}</button>}
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  </fieldset>;
}
