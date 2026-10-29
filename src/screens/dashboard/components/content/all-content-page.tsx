"use client";

import { PublishedCalendar } from "../published/published-calendar";
import { useContentOverview } from "./use-content-overview";
import { ContentPerformance } from "./content-performance";
import { SavedSlideshowPreview } from "@/domains/slideshow/client/components/saved-slideshow-preview";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectMetadataButton } from "../projects/project-metadata-button";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short",
});

export function AllContentPage({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const { posts, projects, loading, error } = useContentOverview();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const published = new Map(posts.map(post => [post.id,post]));
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const ordered = [...projects].filter(project => !selectedDate || published.get(project.id)?.publishedOn === selectedDate).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));

  async function open(id: string) {
    setOpening(id); setOpenError("");
    try { await onOpen(id); }
    catch (cause) { setOpenError(cause instanceof Error ? cause.message : "콘텐츠를 열지 못했습니다."); }
    finally { setOpening(null); }
  }

  return <section className="grid gap-6" aria-labelledby="all-content-heading">
    <h1 id="all-content-heading" className="text-3xl font-semibold tracking-tight">모든 콘텐츠</h1>
    <PublishedCalendar posts={posts} month={month} selectedDate={selectedDate} onMonthChange={value => { setMonth(value); setSelectedDate(null); }} onSelectDate={value => setSelectedDate(current => current === value ? null : value)} />
    <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{selectedDate ? `${selectedDate} 게시 콘텐츠` : "전체 목록"}</h2>{selectedDate && <Button variant="outline" onClick={() => setSelectedDate(null)}>전체 보기</Button>}</div>
    {(error || openError) && <p role="alert" className="text-sm text-destructive">{error || openError}</p>}
    {loading ? <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p> :
      <div role="list" className="min-w-0 divide-y rounded-xl border">
        {ordered.map(project => <article role="listitem" key={project.id} className="min-w-0 p-5">
          <div className="flex items-center justify-between gap-4">
          <button type="button" className="min-w-0 flex-1 text-left hover:underline disabled:opacity-50" disabled={opening !== null} onClick={() => void open(project.id)}>
            <span className="block truncate font-medium">{project.name}</span>
            {project.topic && <span className="mt-1 block text-sm text-muted-foreground">{project.topic}</span>}
            <span className="mt-2 block text-xs text-muted-foreground">{project.slideCount}장 · {dateFormatter.format(new Date(project.createdAt))}</span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <ProjectMetadataButton project={project} disabled={opening !== null} />
            <Button type="button" variant="outline" size="icon" aria-label={`${project.name} 열기`} disabled={opening !== null} onClick={() => void open(project.id)}><ArrowUpRight aria-hidden="true" /></Button>
          </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{published.get(project.id) ? <a className="underline" href={published.get(project.id)!.postUrl} target="_blank" rel="noreferrer">게시됨 · {published.get(project.id)!.publishedOn}</a> : "미게시"}</p>
          {published.has(project.id) && <ContentPerformance records={published.get(project.id)!.performance ?? []} />}
          <SavedSlideshowPreview key={project.updatedAt} project={project} />
        </article>)}
        {!ordered.length && <p className="p-8 text-sm text-muted-foreground">저장된 콘텐츠가 없습니다.</p>}
      </div>}
  </section>;
}
