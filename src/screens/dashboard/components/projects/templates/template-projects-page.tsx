"use client";
import { VideoProjectCard } from "@/screens/dashboard/components/projects/video-project-card";
import { useState } from "react";
import type { SavedTemplateSummary } from "@/domains/slideshow/domain/projects";
import { useSavedProjects } from "@/domains/workspace/client/use-saved-projects";
import { publishProject } from "@/domains/slideshow/client/projects-api";
import { deleteTemplate } from "@/domains/slideshow/client/templates-api";
import { SavedProjectCard, TemplateCard } from "./project-cards";

export function TemplateProjectsPage({ onOpen }: { onOpen: (projectId: string) => Promise<void> }) {
  const { projects, videos, templates, loading, error, setError } = useSavedProjects();
  const [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  async function removeTemplate(template: SavedTemplateSummary) {
    if (!window.confirm(`“${template.name}” 템플릿을 삭제할까요? 템플릿과 템플릿 이미지가 삭제되고 연결된 게시글의 부모가 해제됩니다. 게시글은 유지됩니다.`)) return;
    await run(() => deleteTemplate(template.id));
  }
  return <div className="grid gap-8">
    <header><h1 className="text-3xl font-semibold tracking-tight">템플릿 프로젝트</h1><p className="mt-2 text-sm text-muted-foreground">독립 템플릿과 게시글을 관리하세요.</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">프로젝트를 불러오는 중…</p> : <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-10">
      <section aria-labelledby="template-projects-heading" className="min-w-0">
        <h2 id="template-projects-heading" className="border-b pb-4 font-semibold">템플릿 프로젝트 <span aria-hidden="true" className="text-muted-foreground">{templates.length}</span></h2>
        <div role="list" className="divide-y">{templates.map(template =>
          <TemplateCard key={template.id} project={template} busy={busy}
            onOpen={id => void run(() => onOpen(id))} onRemove={project => void removeTemplate(project)} />)}</div>
        {!templates.length && <p className="py-8 text-sm text-muted-foreground">아직 템플릿이 없습니다. 저장된 프로젝트에서 템플릿을 만드세요.</p>}
      </section>
      <section aria-labelledby="saved-projects-heading" className="min-w-0"><h2 id="saved-projects-heading" className="border-b pb-4 font-semibold">저장된 프로젝트 <span aria-hidden="true" className="text-muted-foreground">{projects.length + videos.length}</span></h2>
        <p className="mt-3 text-xs text-muted-foreground">게시글의 페이지를 선택해 독립 템플릿으로 만들 수 있습니다.</p>
        <div role="list" className="divide-y">{videos.map(project => <VideoProjectCard key={project.id} project={project} busy={busy} run={run} onOpen={id => void run(() => onOpen(id))} />)}{projects.map(project => <SavedProjectCard key={project.id} project={project} busy={busy} templates={templates}
          onOpen={id => void run(() => onOpen(id))} onPublish={id => void run(() => publishProject(id))} />)}</div>
        {!projects.length && !videos.length && <p className="py-8 text-sm text-muted-foreground">아직 저장된 프로젝트가 없습니다.</p>}
      </section>
    </div>}
  </div>;
}
