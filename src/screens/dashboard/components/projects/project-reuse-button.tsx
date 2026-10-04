"use client";

import { useId, useState } from "react";
import { emptyReuseGuide, REUSE_GUIDE_FIELDS } from "@/lib/content-jobs/projects/reuse-guide";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";
import { updateProjectReuse } from "@/screens/projects/api";

export function ProjectReuseButton({ project, mode = "guide", disabled, size = "default" }: {
  project: SavedProjectSummary; mode?: "guide" | "register"; disabled?: boolean; size?: "default" | "sm";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(project.reuseGuide ?? emptyReuseGuide());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function show() {
    setGuide(project.reuseGuide ?? emptyReuseGuide()); setError(""); setOpen(true);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      await updateProjectReuse(project.id, { reuseGuide: guide, ...(mode === "register" ? { isTemplate: true } : {}) });
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "재사용 설정을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <>
    <Button variant={mode === "register" ? "default" : "outline"} size={size} disabled={disabled || saving}
      onClick={show} aria-label={`${project.name} ${mode === "register" ? "템플릿 지정" : "재사용 가이드 편집"}`}>
      {mode === "register" && <LayoutTemplate aria-hidden="true" />}
      {mode === "register" ? "템플릿 지정" : "가이드 편집"}
    </Button>
    <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "register" ? "템플릿 지정" : "재사용 가이드 편집"}</DialogTitle>
          <DialogDescription>‘{project.name}’의 역할과 선택 기준을 네 항목으로 작성하세요. 시각적 특징은 템플릿이 담당합니다.{mode === "register" && " 저장하면 이 원본이 템플릿으로 지정됩니다."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid gap-5">
          {REUSE_GUIDE_FIELDS.map(({ key, label, description, placeholder }) => <div key={key} className="grid gap-2">
            <label htmlFor={`${id}-${key}`} className="text-sm font-medium">{label}</label>
            <Textarea id={`${id}-${key}`} value={guide[key]}
              onChange={event => setGuide(previous => ({ ...previous, [key]: event.target.value }))}
              maxLength={1000} rows={2} disabled={saving} required={mode === "register" || project.isTemplate}
              aria-describedby={`${id}-${key}-hint`} placeholder={placeholder} />
            <p id={`${id}-${key}-hint`} className="text-xs text-muted-foreground">{description}</p>
          </div>)}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>취소</Button>
            <Button type="submit" disabled={saving}>{saving ? "저장 중…" : mode === "register" ? "저장하고 템플릿 지정" : "저장"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
