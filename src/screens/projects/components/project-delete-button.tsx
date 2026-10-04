"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteProject } from "../api";

export function ProjectDeleteButton({ projectId, name, tabId, disabled, compact = false }: {
  projectId: string; name: string; tabId?: string; disabled?: boolean; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    setDeleting(true); setError("");
    try { await deleteProject(projectId, tabId); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "프로젝트를 삭제하지 못했습니다."); }
    finally { setDeleting(false); }
  }
  return <>
    <Button variant="destructive" size={compact ? "icon-sm" : "sm"} disabled={disabled || deleting}
      aria-label={compact ? `${name} 프로젝트 삭제` : "프로젝트 삭제"} onClick={() => { setError(""); setOpen(true); }}>
      <Trash2 className="size-4" aria-hidden="true" />{!compact && "프로젝트 삭제"}
    </Button>
    <Dialog open={open} onOpenChange={deleting ? undefined : setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>프로젝트를 삭제할까요?</DialogTitle>
          <DialogDescription>‘{name}’의 저장본과 열린 탭을 삭제합니다. 저장되지 않은 변경과 이 프로젝트의 이미지도 함께 삭제됩니다.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={deleting} onClick={() => setOpen(false)}>취소</Button>
          <Button variant="destructive" disabled={deleting} onClick={() => void remove()}>{deleting ? "삭제 중…" : "삭제"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
