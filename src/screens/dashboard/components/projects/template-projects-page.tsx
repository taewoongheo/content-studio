"use client";
import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronRight, FolderOpen, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";
import { useSavedProjects } from "@/screens/projects/use-saved-projects";
import { publishProject, reorderTemplates, deleteTemplate } from "@/screens/projects/api";
import { ProjectDeleteButton } from "@/screens/projects/components/project-delete-button";
import { ProjectMetadataButton } from "./project-metadata-button";
import { ProjectReuseButton } from "./project-reuse-button";
import { TemplatePreviews } from "./previews/template-previews";
import { SortableTemplate } from "./sortable-template";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric" });
export function TemplateProjectsPage({ onOpen }: { onOpen: (projectId: string) => Promise<void> }) {
  const { projects, templates: allTemplates, loading, error, setError } = useSavedProjects();
  const [busy, setBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const dragId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const active = allTemplates.filter(template => template.templateOrder !== null);
  const templates = pendingIds ? pendingIds.map(id => active.find(template => template.id === id)).filter((item): item is SavedProjectSummary => !!item) : active;
  async function run(work: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다."); }
    finally { setBusy(false); }
  }
  const latest = projects.filter(project => project.publishedAt).sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))
    .find(project => active.some(template => template.id === (project.sourceTemplateProjectId ?? project.id)));
  const lastIndex = latest ? active.findIndex(template => template.id === (latest.sourceTemplateProjectId ?? latest.id)) : -1;
  const nextTemplate = active.length ? active[(lastIndex + 1) % active.length] : null;
  async function removeTemplate(template: SavedProjectSummary) {
    if (!window.confirm(`“${template.name}” 루프에서 제외할까요? 템플릿 설정이 삭제되고 연결된 게시글의 부모가 해제됩니다. 원본 콘텐츠는 유지됩니다.`)) return;
    await run(() => deleteTemplate(template.id));
  }
  function card(project: SavedProjectSummary, templateCard: boolean) {
    return <article key={project.id} role="listitem" className="grid min-w-0 gap-4 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-3"><h3 className="min-w-0 break-words font-medium leading-snug">{templateCard && project.templateOrder !== null && `${project.templateOrder}. `}{project.name}</h3></div>
        <p className="mt-1.5 text-xs text-muted-foreground">{project.aspectRatio} · {project.slideCount}장 · {dateFormatter.format(new Date(project.updatedAt))}</p>
        {!templateCard && project.topic && <p className="mt-2 text-sm">{project.topic}</p>}
        {!templateCard && project.message && <p className="mt-1 text-sm text-muted-foreground">{project.message}</p>}
        {!templateCard && project.sourceTemplateName && <p className="mt-2 text-xs text-muted-foreground">부모 템플릿: {project.sourceTemplateName}</p>}
        {project.publishedAt && <p className="mt-2 text-xs text-muted-foreground">게시됨 · {dateFormatter.format(new Date(project.publishedAt))}</p>}
        {templateCard && <TemplatePreviews project={project} contentUpdatedAt={projects.find(item => item.id === project.id)?.updatedAt ?? project.updatedAt} />}
        {templateCard && <details className="group mt-3 text-sm leading-relaxed"><summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium focus-visible:outline-2 [&::-webkit-details-marker]:hidden"><ChevronRight className="size-4 group-open:rotate-90" aria-hidden="true" />구성</summary><dl className="mt-3 grid gap-3">
          <div><dt className="text-xs font-medium">주제</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{project.topic}</dd></div>
          <div><dt className="text-xs font-medium">메시지</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{project.message}</dd></div>
          <div><dt className="text-xs font-medium">구성</dt><dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{project.composition}</dd></div>
        </dl></details>}
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => onOpen(project.id))}><FolderOpen aria-hidden="true" />열기</Button>
        {templateCard ? <>
          <ProjectReuseButton project={project} disabled={busy} size="sm" />
          <Button variant="outline" size="sm" disabled={busy} aria-label={`${project.name} 루프에서 제외`}
            onClick={() => void removeTemplate(project)}>루프에서 제외</Button>
        </> : <>
          <ProjectMetadataButton project={project} templates={allTemplates} disabled={busy} />
          {project.isTemplate ? <Button variant="secondary" size="sm" disabled><LayoutTemplate aria-hidden="true" />템플릿 지정됨</Button> : <ProjectReuseButton project={project} mode="register" disabled={busy} size="sm" />}
          <Button variant="outline" size="sm" disabled={busy || !!project.publishedAt} aria-label={`${project.name} 게시 등록`} onClick={() => void run(() => publishProject(project.id))}>{project.publishedAt ? "게시됨" : "게시"}</Button>
          {!project.isTemplate && <ProjectDeleteButton projectId={project.id} name={project.name} compact disabled={busy} />}
        </>}
      </div>
    </article>;
  }
  return <div className="grid gap-8">
    <header><h1 className="text-3xl font-semibold tracking-tight">템플릿 프로젝트</h1><p className="mt-2 text-sm text-muted-foreground">템플릿 설정과 원본 콘텐츠를 함께 관리하세요. 순서는 드래그로 변경합니다.</p></header>
    {nextTemplate && <p className="text-sm text-muted-foreground">다음 템플릿: {nextTemplate.templateOrder}. {nextTemplate.name}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading ? <p role="status">프로젝트를 불러오는 중…</p> : <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-10">
      <section aria-labelledby="template-projects-heading" className="min-w-0">
        <h2 id="template-projects-heading" className="border-b pb-4 font-semibold">템플릿 프로젝트 <span aria-hidden="true" className="text-muted-foreground">{templates.length}</span></h2>
        <p className="mt-3 text-xs text-muted-foreground">등록된 순서로 반복합니다. 핸들을 드래그하거나 Space와 방향키로 이동하세요.</p>
        <DndContext id={dragId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={async ({ active: dragged, over }) => {
          if (busy || !over || dragged.id === over.id) return;
          const expectedIds = active.map(template => template.id);
          const from = expectedIds.indexOf(String(dragged.id)), to = expectedIds.indexOf(String(over.id));
          if (from < 0 || to < 0) return;
          const ids = arrayMove(expectedIds, from, to);
          setPendingIds(ids);
          await run(() => reorderTemplates(ids, expectedIds));
          setPendingIds(null);
        }}><SortableContext items={templates.map(template => template.id)} strategy={verticalListSortingStrategy}>
          <div role="list" className="divide-y">{templates.map(template => <SortableTemplate key={template.id} id={template.id} name={template.name} disabled={busy}>{card(template, true)}</SortableTemplate>)}</div>
        </SortableContext></DndContext>
        {!templates.length && <p className="py-8 text-sm text-muted-foreground">루프에 포함된 템플릿이 없습니다. 저장된 프로젝트에서 루프에 추가하세요.</p>}
      </section>
      <section aria-labelledby="saved-projects-heading" className="min-w-0"><h2 id="saved-projects-heading" className="border-b pb-4 font-semibold">저장된 프로젝트 <span aria-hidden="true" className="text-muted-foreground">{projects.length}</span></h2>
        <p className="mt-3 text-xs text-muted-foreground">원본의 내용 정보와 템플릿 설정은 독립적으로 저장됩니다.</p>
        <div role="list" className="divide-y">{projects.map(project => card(project, false))}</div>
        {!projects.length && <p className="py-8 text-sm text-muted-foreground">아직 저장된 프로젝트가 없습니다.</p>}
      </section>
    </div>}
  </div>;
}
