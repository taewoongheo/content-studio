"use client";

import { useId, useState, useEffect } from "react";
import { COMPOSITION_LIMIT } from "@/domains/slideshow/templates/metadata";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SavedProjectSummary, SavedTemplateSummary } from "@/domains/slideshow/domain/projects";
import { TemplatePagePicker } from "./previews/template-page-picker";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { readSavedDocument } from "@/domains/slideshow/client/projects-api";
import { createTemplate, updateTemplateSettings } from "@/domains/slideshow/client/templates-api";

export function TemplateDialogButton({ project, mode = "guide", disabled, size = "default" }: {
  project: SavedProjectSummary | SavedTemplateSummary; mode?: "guide" | "register"; disabled?: boolean; size?: "default" | "sm";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [topic, setTopic] = useState(project.topic || project.name);
  const [message, setMessage] = useState(project.message || `${project.name}의 내용을 전달한다.`);
  const [composition, setComposition] = useState("composition" in project ? project.composition : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [document, setDocument] = useState<EditorDocument | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (!open || mode !== "register") return;
    let active = true;
    void readSavedDocument(project.id).then(doc => { if (active) { setDocument(doc); setSelectedIds(doc.slides.map(slide => slide.id)); } })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "페이지를 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [open, mode, project.id]);

  function show() {
    setName(project.name); setTopic(project.topic || project.name); setMessage(project.message || `${project.name}의 내용을 전달한다.`);
    setComposition("composition" in project ? project.composition : ""); setDocument(null); setSelectedIds([]); setError(""); setOpen(true);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      const input = { composition, templateName: name, templateTopic: topic, templateMessage: message };
      if (mode === "register") await createTemplate(project.id, { ...input, slideIds: selectedIds });
      else await updateTemplateSettings(project.id, input);
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "재사용 설정을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <>
    <Button variant={mode === "register" ? "default" : "outline"} size={size} disabled={disabled || saving}
      onClick={show} aria-label={`${project.name} ${mode === "register" ? "템플릿으로 만들기" : "템플릿 설정"}`}>
      {mode === "register" && <LayoutTemplate aria-hidden="true" />}
      {mode === "register" ? "템플릿으로 만들기" : "템플릿 설정"}
    </Button>
    <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "register" ? "템플릿으로 만들기" : "템플릿 설정"}</DialogTitle>
          <DialogDescription>‘{project.name}’에서 주제가 바뀌어도 재사용할 수 있는 콘텐츠 유형·전달 목적·시각적 구조를 작성하세요.{mode === "register" && " 선택한 페이지를 별도 템플릿으로 복사합니다."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid gap-5">
          <div className="grid gap-2"><label htmlFor={`${id}-name`}>템플릿 이름</label><Input id={`${id}-name`} value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={saving} /></div>
          <div className="grid gap-2"><label htmlFor={`${id}-topic`}>템플릿 주제</label><Input id={`${id}-topic`} value={topic} onChange={event => setTopic(event.target.value)} required maxLength={200} disabled={saving} placeholder="예: 부위별 운동 선택 가이드" aria-describedby={`${id}-topic-hint`} /><p id={`${id}-topic-hint`} className="text-xs text-muted-foreground">원본의 특정 부위나 제목 대신 반복 제작할 콘텐츠 유형을 적어주세요.</p></div>
          <div className="grid gap-2"><label htmlFor={`${id}-message`}>템플릿 메시지</label><Textarea id={`${id}-message`} value={message} onChange={event => setMessage(event.target.value)} required maxLength={2000} rows={3} disabled={saving} placeholder="예: 각 부위의 운동 대안을 비교하고 하나씩 골라 루틴을 구성하도록 돕는다." aria-describedby={`${id}-message-hint`} /><p id={`${id}-message-hint`} className="text-xs text-muted-foreground">원본의 결론 대신 이 형식이 독자의 이해·선택·실행을 어떻게 돕는지 적어주세요.</p></div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-composition`} className="text-sm font-medium">구성</label>
            <Textarea id={`${id}-composition`} value={composition} onChange={event => setComposition(event.target.value)}
              maxLength={COMPOSITION_LIMIT} rows={6} disabled={saving} required
              aria-describedby={`${id}-hint`}
              placeholder="도입 후 정보를 그룹별로 나눈다. 각 그룹에서 여러 선택지를 함께 보여주고 하나를 선택하도록 안내한다. 선택지마다 이미지·이름·짧은 보조 정보를 배치한다." />
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">어떤 메시지 유형(비교·선택·설명·실행 안내)에 적합한지, 이를 돕는 시각적 구조와 페이지 흐름을 적어주세요. 현재 게시글의 구체적인 내용은 제외합니다.</p>
          </div>
          {mode === "register" && (document ? <TemplatePagePicker document={document} projectId={project.id} selectedIds={selectedIds} onChange={setSelectedIds} disabled={saving} />
            : <p role="status" className="text-sm text-muted-foreground">페이지 불러오는 중…</p>)}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={saving || (mode === "register" && (!document || !selectedIds.length))}>{saving ? "저장 중…" : mode === "register" ? "저장하고 템플릿으로 만들기" : "저장"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
