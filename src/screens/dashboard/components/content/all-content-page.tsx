"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useSavedProjects } from "@/domains/workspace/client/use-saved-projects";
import { Button } from "@/components/ui/button";
import { ProjectMetadataButton } from "../projects/project-metadata-button";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

export function AllContentPage({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const { projects, loading, error } = useSavedProjects(true, true);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const ordered = [...projects].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  async function open(id: string) {
    setOpening(id); setOpenError("");
    try { await onOpen(id); }
    catch (cause) { setOpenError(cause instanceof Error ? cause.message : "콘텐츠를 열지 못했습니다."); }
    finally { setOpening(null); }
  }

  return <section className="grid gap-6" aria-labelledby="all-content-heading">
    <h1 id="all-content-heading" className="text-3xl font-semibold tracking-tight">모든 콘텐츠</h1>
    {(error || openError) && <p role="alert" className="text-sm text-destructive">{error || openError}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p> :
      <div role="list" className="divide-y rounded-xl border">
        {ordered.map(project => <article role="listitem" key={project.id} className="flex items-center justify-between gap-4 p-5">
          <button type="button" className="min-w-0 flex-1 text-left hover:underline disabled:opacity-50" disabled={opening !== null} onClick={() => void open(project.id)}>
            <span className="block truncate font-medium">{project.name}</span>
            {project.topic && <span className="mt-1 block text-sm text-muted-foreground">{project.topic}</span>}
            <span className="mt-2 block text-xs text-muted-foreground">{project.slideCount}장 · {dateFormatter.format(new Date(project.createdAt))}</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <ProjectMetadataButton project={project} disabled={opening !== null} />
            <Button type="button" variant="outline" size="icon" aria-label={`${project.name} 열기`} disabled={opening !== null} onClick={() => void open(project.id)}><ArrowUpRight aria-hidden="true" /></Button>
          </div>
        </article>)}
        {!ordered.length && <p className="p-8 text-sm text-muted-foreground">저장된 콘텐츠가 없습니다.</p>}
      </div>}
  </section>;
}
