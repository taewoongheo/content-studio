"use client";
import type { ProductionRequest } from "@/domains/content-production/domain/start/input";

export type StartMode = "automatic" | "reference" | "external_url";
export type ReferenceMode = "past_post" | "spy_reference";

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
export function RequestModeSelector({ startMode, referenceMode, onStartMode, onReferenceMode }: {
  startMode: StartMode; referenceMode: ReferenceMode;
  onStartMode: (mode: StartMode) => void; onReferenceMode: (mode: ReferenceMode) => void;
}) {
  const isReference = startMode === "reference";
  const mode = isReference ? referenceMode : startMode;
  return (
    <div className="shrink-0 space-y-2 [@media(max-height:450px)]:flex [@media(max-height:450px)]:gap-2 [@media(max-height:450px)]:space-y-0">
      <fieldset className="grid min-w-0 flex-1 grid-cols-3 gap-2 [@media(max-height:450px)]:flex-[1.3]">
        <legend className="sr-only">생성 방식</legend>
        {startModes.map(({ value, label }) =>
          <label key={value} className={`min-w-0 cursor-pointer rounded-lg border p-2 ${startMode === value ? "border-foreground bg-muted" : "hover:bg-muted/50"}`}>
            <span className="flex items-center gap-2 whitespace-nowrap text-xs font-medium sm:text-sm"><input type="radio" aria-label={label} name="production-mode" value={value} checked={startMode === value} onChange={() => onStartMode(value)} />{label}</span>
          </label>)}
      </fieldset>
      {isReference && <fieldset className="flex min-w-0 flex-1 gap-1 rounded-lg bg-muted p-1">
        <legend className="sr-only">레퍼런스 출처</legend>
        {referenceModes.map(({ value, label }) => <label key={value} className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-2 py-1.5 text-xs ${mode === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>
          <input type="radio" name="reference-mode" aria-label={label} checked={mode === value} onChange={() => onReferenceMode(value)} />{label}
        </label>)}
      </fieldset>}
      <p className="text-xs leading-5 text-muted-foreground [@media(max-height:650px)]:hidden">{descriptions[mode]}</p>
    </div>
  );
}
