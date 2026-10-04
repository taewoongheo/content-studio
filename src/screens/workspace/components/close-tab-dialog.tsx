"use client";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CloseTabDialog({ tab, busy, error, onCancel, onDecision }: {
  tab: OpenProjectTab; busy: boolean; error: string; onCancel: () => void; onDecision: (decision: "save" | "discard") => void;
}) {
  return <Dialog open onOpenChange={busy ? undefined : open => { if (!open) onCancel(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>변경 사항을 저장하고 종료할까요?</DialogTitle>
        <DialogDescription>‘{tab.name}’에 저장되지 않은 변경 사항이 있습니다. 저장하지 않고 종료하면 이번 변경을 잃습니다.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="flex-wrap">
        <Button variant="ghost" disabled={busy} onClick={onCancel}>취소</Button>
        <Button variant="outline" disabled={busy} onClick={() => onDecision("discard")}>저장하지 않고 종료</Button>
        <Button disabled={busy} onClick={() => onDecision("save")}>저장 후 종료</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
