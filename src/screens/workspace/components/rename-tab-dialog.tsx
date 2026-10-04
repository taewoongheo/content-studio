"use client";
import { useState } from "react";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function RenameTabDialog({ tab, busy, error, onCancel, onRename }: {
  tab: OpenProjectTab; busy: boolean; error: string; onCancel: () => void; onRename: (name: string) => void;
}) {
  const [name, setName] = useState(tab.name);
  return <Dialog open onOpenChange={busy ? undefined : open => { if (!open) onCancel(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>프로젝트 이름 변경</DialogTitle><DialogDescription>탭 이름과 프로젝트 이름을 함께 변경합니다.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); onRename(name); }} className="grid gap-4">
        <Input aria-label="프로젝트 이름" autoFocus value={name} maxLength={120} disabled={busy} onChange={event => setName(event.target.value)} />
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>취소</Button>
          <Button type="submit" disabled={busy || !name.trim()}>이름 변경</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
