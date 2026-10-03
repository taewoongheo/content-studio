"use client";

import { useEffect, useState } from "react";
import { FolderOpen, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";
import { listContentProjects, loadContentProject } from "@/screens/projects/api";
import { ProjectPromptCopyButton } from "@/screens/projects/components/project-prompt-copy-button";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function SavedProjectsPage({ onOpen }: {
  onOpen: (job: ContentJobSnapshot, projectName: string) => void;
}) {
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listContentProjects()
      .then((items) => { if (active) setProjects(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "프로젝트를 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function openProject(project: SavedProjectSummary) {
    setOpeningId(project.id);
    setError("");
    try {
      onOpen(await loadContentProject(project.id), project.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "프로젝트를 열지 못했습니다.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <div className="grid gap-7">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">저장된 프로젝트</h1>
        <p className="mt-2 text-sm text-muted-foreground">중간 저장한 콘텐츠를 이어서 편집하세요.</p>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">프로젝트를 불러오는 중…</p>
      ) : projects.length === 0 ? (
        <p className="border-y border-dashed px-2 py-10 text-sm text-muted-foreground">아직 저장된 프로젝트가 없습니다.</p>
      ) : (
        <div className="divide-y border-y" role="list">
          {projects.map((project) => (
            <article key={project.id} role="listitem"
              className="flex items-center justify-between gap-5 py-4 [content-visibility:auto]">
              <div className="min-w-0">
                <h2 className="truncate font-medium">{project.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {project.aspectRatio} · {project.slideCount}장 · {project.outputLanguage} · {dateFormatter.format(new Date(project.updatedAt))}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
                <Button type="button" variant="outline" className="shrink-0" disabled={openingId !== null}
                  onClick={() => void openProject(project)}>
                  {openingId === project.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
                  열기
                </Button>
                <ProjectPromptCopyButton projectId={project.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
