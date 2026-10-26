"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";
import { updateProjectMetadata } from "@/domains/slideshow/client/projects-api";

export function ProjectMetadataButton({ project, disabled }: { project: SavedProjectSummary; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(project.topic);
  const [message, setMessage] = useState(project.message);
  const [format, setFormat] = useState(project.content_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try { await updateProjectMetadata(project.id, { topic, message, content_type: format }); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "내용 정보를 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled} aria-label={`${project.name} 내용 정보`}
      onClick={() => { setTopic(project.topic); setMessage(project.message); setFormat(project.content_type); setError(""); setOpen(true); }}>내용 정보</Button>
    <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>내용 정보</DialogTitle><DialogDescription>‘{project.name}’이 다루는 소재와 메시지·포맷을 기록하세요.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="grid gap-2"><label htmlFor={`${id}-topic`}>소재</label><Input id={`${id}-topic`} value={topic} onChange={event => setTopic(event.target.value)} required maxLength={200} disabled={saving} placeholder="예: 등 운동" /></div>
          <div className="grid gap-2"><label htmlFor={`${id}-message`}>메시지</label><Textarea id={`${id}-message`} value={message} onChange={event => setMessage(event.target.value)} required maxLength={2000} rows={4} disabled={saving} placeholder="예: 허리 부담을 줄이려는 사람에게 등 운동 선택 기준을 설명한다." /></div>
          <div className="grid gap-2"><label htmlFor={`${id}-format`}>포맷</label><Textarea id={`${id}-format`} value={format} onChange={event => setFormat(event.target.value)} required maxLength={1000} rows={3} disabled={saving} placeholder="예: 운동을 등급별 행에 배치해 비교하는 티어표" /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중…" : "저장"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
