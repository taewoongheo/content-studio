"use client";
import { useState } from "react";
import Link from "next/link";
import { ProductionWorkspace } from "../components/production-workspace";
import { usePreviewProduction } from "./use-preview-production";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function ProductionPreviewScreen() {
  const preview = usePreviewProduction();
  const [opened, setOpened] = useState<string | null>(null);
  const log = preview.runtime.data.logs.find(log => log.project_id === opened);
  const task = preview.runtime.data.tasks.find(task => task.project_id === opened);
  return <div className="flex h-svh min-h-0 flex-col bg-background text-foreground">
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-muted px-4 py-2 text-xs" aria-label="미리보기 제어">
      <Link href="/" prefetch={false} className="mr-2 underline underline-offset-4">실제 작업 공간</Link>
      <span className="font-semibold">미리보기 · 메모리 mock</span>
      <button className="production-button" disabled={!preview.canStart} onClick={() => preview.start(4)}>4개 병렬 재생</button>
      <button className="production-button" onClick={() => preview.setPaused(!preview.paused)}>{preview.paused ? "계속 재생" : "일시정지"}</button>
      <button className="production-button" onClick={preview.step}>다음 이벤트</button>
      <button className="production-button" onClick={preview.reset}>초기화</button>
      <label className="flex items-center gap-2">속도<select aria-label="재생 속도" className="rounded border bg-background px-2 py-1" value={preview.speed} onChange={e => preview.setSpeed(Number(e.target.value))}>
        <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option>
      </select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={preview.withFailure} onChange={e => preview.setWithFailure(e.target.checked)} />다음 재생에 오류 포함</label>
    </header>
    <div className="min-h-0 flex-1">
      <ProductionWorkspace runtime={preview.runtime} readWork={preview.readWork} settings={<p className="text-sm text-muted-foreground">미리보기에서는 외부 계정을 연결하지 않습니다. 모델 변경과 모든 작업은 이 화면의 메모리에만 반영됩니다.</p>} onOpen={async id => setOpened(id)} />
    </div>
    <Dialog open={opened !== null} onOpenChange={open => { if (!open) setOpened(null); }}>
      <DialogContent className="w-[min(56rem,calc(100vw-2rem))] max-w-none sm:max-w-none">
        <DialogHeader><DialogTitle>{String(log?.topic ?? task?.topic ?? "예시 포스트")}</DialogTitle><DialogDescription>포스트 열기 동작을 확인하기 위한 mock입니다. 실제 편집기나 저장 프로젝트를 열지 않습니다.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-3 gap-4">{["훅", "본문", "CTA"].map((label, index) => <div key={label} className="flex aspect-[4/5] flex-col justify-between rounded-lg border bg-white p-5 text-black">
          <span className="text-xs text-neutral-500">{label} · MOCK</span>
          <p className="text-sm font-semibold">{index === 0 ? String(log?.topic ?? task?.topic ?? "YOUR NEXT WORKOUT") : index === 1 ? String(log?.message ?? "바로 실행할 수 있는 운동 구성") : "YOUR PLAN. YOUR PACE. LIFTCODE."}</p>
          <span className="text-[10px] tracking-widest">LIFTCODE</span>
        </div>)}</div>
      </DialogContent>
    </Dialog>
  </div>;
}
