"use client";

import { useId, useState } from "react";
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
  const [guide, setGuide] = useState(project.reuseGuide);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function show() {
    setGuide(project.reuseGuide); setError(""); setOpen(true);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "register" ? "템플릿 지정" : "재사용 가이드 편집"}</DialogTitle>
          <DialogDescription>‘{project.name}’에 적합한 게시글 유형과 재사용 상황을 작성하세요.{mode === "register" && " 저장하면 이 원본이 템플릿으로 지정됩니다."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="grid gap-5">
          <div className="grid gap-2">
            <label htmlFor={`${id}-guide`} className="text-sm font-medium">재사용 가이드</label>
            <Textarea id={`${id}-guide`} value={guide} onChange={event => setGuide(event.target.value)}
              maxLength={4000} rows={6} disabled={saving} required={mode === "register" || project.isTemplate}
              aria-describedby={`${id}-hint`}
              placeholder="운동별 이미지와 세트·횟수가 있는 루틴 소개에 적합합니다. 부위를 바꿔 재사용할 수 있습니다. 큰 훅 제목과 운동 카드, 계정 뱃지를 포함합니다." />
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">적합한 게시글 유형, 재사용 상황, 시각적 구성과 정보량을 적어주세요.</p>
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
