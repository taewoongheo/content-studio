"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";
import { updateProjectMetadata } from "@/domains/slideshow/client/projects-api";

export function ProjectMetadataButton({ project, templates = [], disabled }: { templates?: SavedProjectSummary[]; project: SavedProjectSummary; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(project.topic);
  const [message, setMessage] = useState(project.message);
  const [parentId, setParentId] = useState(project.sourceTemplateProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true); setError("");
    try { await updateProjectMetadata(project.id, { topic, message, ...(!project.isTemplate ? { templateId: parentId || null } : {}) }); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "내용 정보를 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled} aria-label={`${project.name} 내용 정보`}
      onClick={() => { setTopic(project.topic); setMessage(project.message); setParentId(project.sourceTemplateProjectId ?? ""); setError(""); setOpen(true); }}>내용 정보</Button>
    <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>내용 정보</DialogTitle><DialogDescription>‘{project.name}’이 다루는 주제와 전달할 핵심 내용을 기록하세요.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={event => { event.preventDefault(); void save(); }}>
          <div className="grid gap-2"><label htmlFor={`${id}-topic`}>주제</label><Input id={`${id}-topic`} value={topic} onChange={event => setTopic(event.target.value)} required maxLength={200} disabled={saving} placeholder="예: 등 운동" /></div>
          <div className="grid gap-2"><label htmlFor={`${id}-message`}>메시지</label><Textarea id={`${id}-message`} value={message} onChange={event => setMessage(event.target.value)} required maxLength={2000} rows={4} disabled={saving} placeholder="예: 허리 부담을 줄이려는 사람에게 등 운동 선택 기준을 설명한다." /></div>
          {!project.isTemplate && <div className="grid gap-2"><label htmlFor={`${id}-parent`}>부모 템플릿</label>
            <select id={`${id}-parent`} className="h-10 w-full rounded-md border bg-background px-3" value={parentId} onChange={event => setParentId(event.target.value)} disabled={saving}>
              <option value="">템플릿 미지정</option>
              {templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">부모 변경은 연결과 이력 분류만 변경하며 슬라이드 내용은 유지합니다.</p>
          </div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>취소</Button><Button type="submit" disabled={saving}>{saving ? "저장 중…" : "저장"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
