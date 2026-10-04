"use client";

import { useState } from "react";
import { FolderOpen, LayoutTemplate, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";
import { useSavedProjects } from "@/screens/projects/use-saved-projects";
import { updateProjectReuse } from "@/screens/projects/api";
import { ProjectDeleteButton } from "@/screens/projects/components/project-delete-button";
import { ProjectReuseButton } from "./project-reuse-button";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });

export function TemplateProjectsPage({ onOpen }: { onOpen: (projectId: string) => Promise<void> }) {
  const { projects, loading, error, setError } = useSavedProjects();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const templates = projects.filter(project => project.isTemplate);
  const busy = openingId !== null || updatingId !== null;

  async function openProject(projectId: string) {
    setOpeningId(projectId); setError("");
    try { await onOpen(projectId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "프로젝트를 열지 못했습니다."); }
    finally { setOpeningId(null); }
  }

  async function designate(projectId: string, isTemplate: boolean) {
    setUpdatingId(projectId); setError("");
    try { await updateProjectReuse(projectId, { isTemplate }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "템플릿 지정을 변경하지 못했습니다."); }
    finally { setUpdatingId(null); }
  }

  function projectCard(project: SavedProjectSummary, templateColumn: boolean) {
    return <article key={project.id} role="listitem" className="grid min-w-0 gap-4 py-5">
      <div className="min-w-0">
        <h3 className="break-words font-medium leading-snug">{project.name}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {project.aspectRatio} · {project.slideCount}장 · {project.outputLanguage} · {dateFormatter.format(new Date(project.updatedAt))}
        </p>
        {templateColumn && <div className="mt-3 text-sm leading-relaxed">
          <p className="font-medium">구성</p>
          <p className="whitespace-pre-wrap break-words text-muted-foreground">{project.composition || "구성을 작성해 주세요."}</p>
        </div>}
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void openProject(project.id)}>
          {openingId === project.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FolderOpen aria-hidden="true" />}
          열기
        </Button>
        <ProjectReuseButton project={project} disabled={busy} size="sm" />
        {templateColumn ? <>
          <Button type="button" variant="destructive" size="sm" disabled={busy}
            aria-label={`${project.name} 템플릿 해제`} onClick={() => void designate(project.id, false)}>
            {updatingId === project.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <X aria-hidden="true" />}
            템플릿 해제
          </Button>
        </> : <>
          {project.isTemplate ? <Button type="button" variant="secondary" size="sm" disabled>
            <LayoutTemplate aria-hidden="true" />템플릿 지정됨
          </Button> : project.composition.trim() ? <Button type="button" size="sm" disabled={busy}
            aria-label={`${project.name} 템플릿 지정`} onClick={() => void designate(project.id, true)}>
            {updatingId === project.id ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LayoutTemplate aria-hidden="true" />}
            템플릿 지정
          </Button> : <ProjectReuseButton project={project} mode="register" disabled={busy} size="sm" />}
          <ProjectDeleteButton projectId={project.id} name={project.name} compact disabled={busy} />
        </>}
      </div>
    </article>;
  }

  return <div className="grid gap-8">
    <header>
      <h1 className="text-3xl font-semibold tracking-tight">템플릿 프로젝트</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">저장된 프로젝트를 템플릿으로 지정하고 구성을 관리하세요.</p>
    </header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">프로젝트를 불러오는 중…</p> :
      <div className="grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
        <section aria-labelledby="template-projects-heading" className="min-w-0">
          <div className="border-b pb-4">
            <h2 id="template-projects-heading" className="flex items-center gap-2 text-base font-semibold">
              <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden="true" />템플릿 프로젝트
              <span aria-hidden="true" className="ml-auto text-sm font-normal tabular-nums text-muted-foreground">{templates.length}</span>
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">원본을 편집하면 이후 제작에도 반영됩니다. 해제해도 원본은 유지됩니다.</p>
          </div>
          {templates.length ? <div role="list" className="divide-y">{templates.map(project => projectCard(project, true))}</div> :
            <p className="py-8 text-sm leading-relaxed text-muted-foreground">지정된 템플릿이 없습니다. 저장된 프로젝트에서 ‘템플릿 지정’을 눌러주세요.</p>}
        </section>
        <section aria-labelledby="saved-projects-heading" className="min-w-0">
          <div className="border-b pb-4">
            <h2 id="saved-projects-heading" className="flex items-center gap-2 text-base font-semibold">
              <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />저장된 프로젝트
              <span aria-hidden="true" className="ml-auto text-sm font-normal tabular-nums text-muted-foreground">{projects.length}</span>
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">템플릿으로 지정한 프로젝트를 포함한 모든 저장본입니다.</p>
          </div>
          {projects.length ? <div role="list" className="divide-y">{projects.map(project => projectCard(project, false))}</div> :
            <p className="py-8 text-sm text-muted-foreground">아직 저장된 프로젝트가 없습니다.</p>}
        </section>
      </div>}
  </div>;
}
