"use client";

import { useId, useState } from "react";
import { COMPOSITION_LIMIT } from "@/lib/content-jobs/projects/composition";
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
  const [guide, setGuide] = useState(project.composition);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function show() {
    setGuide(project.composition); setError(""); setOpen(true);
  }
  async function save() {
    setSaving(true); setError("");
    try {
      await updateProjectReuse(project.id, { composition: guide, ...(mode === "register" ? { isTemplate: true } : {}) });
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "재사용 설정을 저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  return <>
    <Button variant={mode === "register" ? "default" : "outline"} size={size} disabled={disabled || saving}
      onClick={show} aria-label={`${project.name} ${mode === "register" ? "템플릿 지정" : "구성 편집"}`}>
      {mode === "register" && <LayoutTemplate aria-hidden="true" />}
      {mode === "register" ? "템플릿 지정" : "구성 편집"}
    </Button>
    <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "register" ? "템플릿 지정" : "구성 편집"}</DialogTitle>
          <DialogDescription>‘{project.name}’의 정보 배치와 페이지 흐름을 작성하세요.{mode === "register" && " 저장하면 이 원본이 템플릿으로 지정됩니다."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid gap-5">
          <div className="grid gap-2">
            <label htmlFor={`${id}-composition`} className="text-sm font-medium">구성</label>
            <Textarea id={`${id}-composition`} value={guide} onChange={event => setGuide(event.target.value)}
              maxLength={COMPOSITION_LIMIT} rows={6} disabled={saving} required={mode === "register" || project.isTemplate}
              aria-describedby={`${id}-hint`}
              placeholder="도입 후 정보를 그룹별로 나눈다. 각 그룹에서 여러 선택지를 함께 보여주고 하나를 선택하도록 안내한다. 선택지마다 이미지·이름·짧은 보조 정보를 배치한다." />
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">정보를 묶고 배치하는 방식과 선택·설명·반복 흐름을 적어주세요. 특정 주제나 독자의 목표에 한정하지 않습니다.</p>
          </div>
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
