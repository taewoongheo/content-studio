import { ProjectTypeTag } from "@/components/projects/project-type-tag";
import { ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedProjectSummary, SavedTemplateSummary, SlideshowSummary } from "@/domains/slideshow/domain/projects";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";
import { ProjectMetadataButton } from "../project-metadata-button";
import { ProjectReuseButton } from "../project-reuse-button";
import { TemplatePreviews } from "./template-previews";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", year: "numeric", month: "short", day: "numeric",
});
type CardProps = { project: SavedProjectSummary; busy: boolean; onOpen: (id: string) => void };

function ProjectDetails({ project, title }: { project: SlideshowSummary & { publishedAt?: string | null }; title: string }) {
  return <>
    <div className="flex min-w-0 items-start gap-2"><h3 className="min-w-0 break-words font-medium leading-snug">{title}</h3><ProjectTypeTag /></div>
    <p className="mt-1.5 text-xs text-muted-foreground">
      {project.aspectRatio} · {project.slideCount}장 · {dateFormatter.format(new Date(project.updatedAt))}
    </p>
    {project.publishedAt && <p className="mt-2 text-xs text-muted-foreground">
      게시됨 · {dateFormatter.format(new Date(project.publishedAt))}
    </p>}
  </>;
}

export function TemplateCard({ project, busy, onOpen, contentUpdatedAt, onRemove }: Omit<CardProps, "project"> & { project: SavedTemplateSummary;
  contentUpdatedAt: string; onRemove: (project: SavedTemplateSummary) => void;
}) {
  return <article role="listitem" className="grid min-w-0 gap-4 py-5">
    <div className="min-w-0">
      <ProjectDetails project={project} title={`${project.templateOrder}. ${project.name}`} />
      <TemplatePreviews project={project} contentUpdatedAt={contentUpdatedAt} />
      <details className="group mt-3 text-sm leading-relaxed">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm font-medium focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-4 group-open:rotate-90" aria-hidden="true" />구성
        </summary>
        <dl className="mt-3 grid gap-3">
          {[{ label: "주제", value: project.topic }, { label: "메시지", value: project.message },
            { label: "구성", value: project.composition }].map(({ label, value }) => <div key={label}>
            <dt className="text-xs font-medium">{label}</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{value}</dd>
          </div>)}
        </dl>
      </details>
    </div>
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpen(project.id)}><FolderOpen aria-hidden="true" />열기</Button>
      <ProjectReuseButton project={project} disabled={busy} size="sm" />
      <Button variant="outline" size="sm" disabled={busy} aria-label={`${project.name} 루프에서 제외`}
        onClick={() => onRemove(project)}>루프에서 제외</Button>
    </div>
  </article>;
}

export function SavedProjectCard({ project, busy, onOpen, templates, onPublish }: CardProps & {
  templates: SavedTemplateSummary[]; onPublish: (id: string) => void;
}) {
  return <article role="listitem" className="grid min-w-0 gap-4 py-5">
    <div className="min-w-0">
      <ProjectDetails project={project} title={project.name} />
      {project.topic && <p className="mt-2 text-sm">{project.topic}</p>}
      {project.message && <p className="mt-1 text-sm text-muted-foreground">{project.message}</p>}
      {project.sourceTemplateName && <p className="mt-2 text-xs text-muted-foreground">부모 템플릿: {project.sourceTemplateName}</p>}
    </div>
    <div className="flex min-w-0 flex-wrap items-start gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpen(project.id)}><FolderOpen aria-hidden="true" />열기</Button>
      <ProjectMetadataButton project={project} templates={templates} disabled={busy} />
      <ProjectReuseButton project={project} mode="register" disabled={busy} size="sm" />
      <Button variant="outline" size="sm" disabled={busy || !!project.publishedAt} aria-label={`${project.name} 게시 등록`}
        onClick={() => onPublish(project.id)}>{project.publishedAt ? "게시됨" : "게시"}</Button>
      {<ProjectDeleteButton projectId={project.id} name={project.name} compact disabled={busy} />}
    </div>
  </article>;
}
