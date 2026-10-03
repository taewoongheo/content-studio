"use client";

import { useImperativeHandle, useState, type Ref } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContentProject } from "@/screens/projects/api";

export type ProjectSaveHandle = { saveAutomatically: () => Promise<boolean> };

export function ProjectSaveControl({ ref, jobId, revision, getRevision, defaultName, initialProjectName, currentProjectName, persistedRevision, disabled, onBeforeSave }: {
  ref?: Ref<ProjectSaveHandle>;
  jobId: string;
  revision: number;
  getRevision: () => number;
  defaultName: string;
  initialProjectName?: string;
  currentProjectName?: string;
  persistedRevision?: number;
  disabled: boolean;
  onBeforeSave: () => Promise<boolean>;
}) {
  const [localProjectName, setProjectName] = useState(initialProjectName ?? "");
  const projectName = currentProjectName ?? localProjectName;
  const [draftName, setDraftName] = useState(initialProjectName ?? defaultName);
  const [savedRevision, setSavedRevision] = useState<number | null>(initialProjectName ? revision : null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(name: string) {
    setSaving(true);
    setError("");
    try {
      if (!(await onBeforeSave())) return false;
      const project = await saveContentProject(jobId, name);
      setProjectName(project.name);
      setDraftName(project.name);
      setSavedRevision(getRevision());
      setOpen(false);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트를 저장하지 못했습니다.");
      setOpen(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  useImperativeHandle(ref, () => ({
    saveAutomatically: () => save(projectName || defaultName.trim().slice(0, 120) || "새 콘텐츠"),
  }));

  function requestSave() {
    if (projectName) void save(projectName);
    else setOpen(true);
  }

  const saved = Boolean(projectName) && (persistedRevision ?? savedRevision) === revision;

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={disabled || saving}
        onClick={requestSave} title={projectName ? `“${projectName}”에 저장` : "프로젝트로 저장"}>
        {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
        {saving ? "저장 중" : saved ? "저장됨" : "저장"}
      </Button>
      <Dialog open={open} onOpenChange={saving ? undefined : setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 저장</DialogTitle>
            <DialogDescription>현재 슬라이드의 Element, 레이아웃, 스타일과 사용 이미지를 로컬 DB에 저장합니다.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => {
            event.preventDefault();
            if (draftName.trim()) void save(draftName);
          }}>
            <div className="grid gap-2">
              <Label htmlFor="project-name">프로젝트 이름</Label>
              <Input id="project-name" value={draftName} maxLength={120} autoFocus
                onChange={(event) => setDraftName(event.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>취소</Button>
              <Button type="submit" disabled={saving || !draftName.trim()}>
                {saving && <LoaderCircle className="animate-spin" aria-hidden="true" />}
                저장
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
