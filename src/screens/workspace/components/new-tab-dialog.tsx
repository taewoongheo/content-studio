"use client";
import { useState } from "react";
import { Film, GalleryVerticalEnd } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { OpenProjectTab } from "@/domains/workspace/model";
import { useSavedProjects } from "@/domains/workspace/client/use-saved-projects";
import { ProjectTypeTag } from "@/components/projects/project-type-tag";
type ProjectType = "slideshow" | "video";
export function NewTabDialog({ tabs, open, busy, onOpenChange, onNew, onExisting }: {
  tabs: OpenProjectTab[]; open: boolean; busy: boolean; onOpenChange: (open: boolean) => void;
  onNew: (type: ProjectType) => void; onExisting: (id: string) => void;
}) {
  const [type, setType] = useState<ProjectType>("slideshow");
  const { projects, videos, loading, error } = useSavedProjects(open);
  const choices = new Map<string, { id: string; name: string; opened: boolean }>();
  for (const project of type === "video" ? videos : projects) choices.set(project.id, { id: project.id, name: project.name, opened: false });
  for (const tab of tabs) if ((tab.projectType ?? "slideshow") === type) choices.set(tab.projectId, { id: tab.projectId, name: tab.name, opened: true });
  return <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
    <DialogContent className="w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] min-w-0 max-w-none gap-5 overflow-x-hidden overflow-y-auto transition-none sm:max-w-none">
      <DialogHeader className="min-w-0 pr-6"><DialogTitle>편집기 열기</DialogTitle><DialogDescription>콘텐츠 유형을 선택하고 새로 만들거나 이어서 편집하세요.</DialogDescription></DialogHeader>
      <div role="group" aria-label="편집기 유형" className="grid min-w-0 grid-cols-2 gap-2">
        {([{ id: "slideshow", label: "슬라이드쇼", Icon: GalleryVerticalEnd }, { id: "video", label: "영상", Icon: Film }] as const).map(({ id, label, Icon }) => <Button key={id} variant={type === id ? "secondary" : "outline"} aria-pressed={type === id} className="h-12 min-w-0" disabled={busy} onClick={() => setType(id)}><Icon />{label}</Button>)}
      </div>
      <Button disabled={busy} onClick={() => onNew(type)}>새 {type === "video" ? "영상" : "슬라이드쇼"} 시작</Button>
      <section className="grid min-w-0 gap-3"><h3 className="text-sm font-medium">기존 {type === "video" ? "영상" : "슬라이드쇼"} 프로젝트</h3>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {loading && !error && <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p>}
        {!loading && choices.size === 0 && <p className="py-4 text-sm text-muted-foreground">저장된 프로젝트가 없습니다.</p>}
        <div className="grid max-h-[min(45svh,24rem)] min-w-0 gap-2 overflow-x-hidden overflow-y-auto">
          {[...choices.values()].map(project => <Button key={project.id} variant="outline" className="h-auto min-h-11 w-full min-w-0 justify-start gap-2 py-2" disabled={busy}
            onClick={() => onExisting(project.id)}><span className="min-w-0 flex-1 truncate text-left" title={project.name}>{project.name}</span><ProjectTypeTag type={type} />{project.opened && <span className="shrink-0 text-[10px] text-muted-foreground">열림</span>}</Button>)}
        </div>
      </section>
    </DialogContent>
  </Dialog>;
}
