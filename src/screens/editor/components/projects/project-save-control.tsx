"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveContentProject } from "@/screens/projects/api";

export type ProjectSaveHandle = { saveAutomatically: (onlyIfChanged?: boolean) => Promise<boolean> };

export function ProjectSaveControl({ ref, jobId, tabId, revision, currentProjectName, persistedRevision, disabled, onBeforeSave }: {
  ref?: Ref<ProjectSaveHandle>;
  jobId: string;
  tabId: string;
  revision: number;
  currentProjectName?: string;
  persistedRevision?: number;
  disabled: boolean;
  onBeforeSave: () => Promise<boolean>;
}) {
  const pending = useRef<Promise<boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function save(onlyIfChanged = false): Promise<boolean> {
    if (pending.current) return pending.current.then(saved => saved && save(true));
    const operation = (async () => {
      setSaving(true);
      setError("");
      try {
        if (!(await onBeforeSave())) return false;
        await saveContentProject(jobId, currentProjectName ?? "새 프로젝트", tabId, onlyIfChanged);
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "프로젝트를 저장하지 못했습니다.");
        return false;
      } finally {
        pending.current = null;
        setSaving(false);
      }
    })();
    pending.current = operation;
    return operation;
  }

  useImperativeHandle(ref, () => ({ saveAutomatically: save }));
  const saved = persistedRevision !== undefined && persistedRevision === revision;

  return <>
    <Button type="button" variant="outline" size="sm" disabled={disabled || saving}
      onClick={() => void save()} title="저장 (Ctrl+S / ⌘S)">
      {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
      {saving ? "저장 중" : saved ? "저장됨" : "저장"}
    </Button>
    {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
  </>;
}
