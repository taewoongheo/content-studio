"use client";
import { VideoProjectCard } from "@/screens/video/components/project-card";
import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";
import { useSavedProjects } from "@/screens/projects/use-saved-projects";
import { publishProject, reorderTemplates, deleteTemplate } from "@/screens/projects/api";
import { SortableTemplate } from "./sortable-template";
import { nextTemplateInLoop } from "@/lib/content-jobs/projects/planning/next-template";
import { SavedProjectCard, TemplateCard } from "./project-cards";

export function TemplateProjectsPage({ onOpen }: { onOpen: (projectId: string) => Promise<void> }) {
  const { projects, videos, templates: allTemplates, loading, error, setError } = useSavedProjects();
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
  const nextTemplate = nextTemplateInLoop(active, projects);
  async function removeTemplate(template: SavedProjectSummary) {
    if (!window.confirm(`“${template.name}” 루프에서 제외할까요? 템플릿 설정이 삭제되고 연결된 게시글의 부모가 해제됩니다. 원본 콘텐츠는 유지됩니다.`)) return;
    await run(() => deleteTemplate(template.id));
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
          <div role="list" className="divide-y">{templates.map(template =>
            <SortableTemplate key={template.id} id={template.id} name={template.name} disabled={busy}>
              <TemplateCard project={template} busy={busy}
                contentUpdatedAt={projects.find(project => project.id === template.id)?.updatedAt ?? template.updatedAt}
                onOpen={id => void run(() => onOpen(id))} onRemove={project => void removeTemplate(project)} />
            </SortableTemplate>)}</div>
        </SortableContext></DndContext>
        {!templates.length && <p className="py-8 text-sm text-muted-foreground">루프에 포함된 템플릿이 없습니다. 저장된 프로젝트에서 루프에 추가하세요.</p>}
      </section>
      <section aria-labelledby="saved-projects-heading" className="min-w-0"><h2 id="saved-projects-heading" className="border-b pb-4 font-semibold">저장된 프로젝트 <span aria-hidden="true" className="text-muted-foreground">{projects.length + videos.length}</span></h2>
        <p className="mt-3 text-xs text-muted-foreground">원본의 내용 정보와 템플릿 설정은 독립적으로 저장됩니다.</p>
        <div role="list" className="divide-y">{videos.map(project => <VideoProjectCard key={project.id} project={project} busy={busy} run={run} onOpen={id => void run(() => onOpen(id))} />)}{projects.map(project => <SavedProjectCard key={project.id} project={project} busy={busy} templates={allTemplates}
          onOpen={id => void run(() => onOpen(id))} onPublish={id => void run(() => publishProject(id))} />)}</div>
        {!projects.length && !videos.length && <p className="py-8 text-sm text-muted-foreground">아직 저장된 프로젝트가 없습니다.</p>}
      </section>
    </div>}
  </div>;
}
