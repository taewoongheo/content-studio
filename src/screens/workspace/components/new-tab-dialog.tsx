"use client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";
import { useSavedProjects } from "@/screens/projects/use-saved-projects";

export function NewTabDialog({ tabs, open, busy, onOpenChange, onNew, onExisting }: {
  tabs: OpenProjectTab[]; open: boolean; busy: boolean; onOpenChange: (open: boolean) => void;
  onNew: () => void; onExisting: (id: string) => void;
}) {
  const { projects, loading, error } = useSavedProjects(open);
  const choices = new Map(projects.map(project => [project.id, { id: project.id, name: project.name, opened: false }]));
  for (const tab of tabs) choices.set(tab.projectId, { id: tab.projectId, name: tab.name, opened: true });
  return <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
    <DialogContent className="max-h-[80svh] overflow-y-auto">
      <DialogHeader><DialogTitle>새 탭</DialogTitle><DialogDescription>새 편집기를 시작하거나 기존 프로젝트를 이어서 편집하세요.</DialogDescription></DialogHeader>
      <Button disabled={busy} onClick={onNew}>새 편집기 시작</Button>
      <div className="grid gap-2">
        <h3 className="text-sm font-medium">기존 프로젝트</h3>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        {loading && !error && <p role="status" className="text-sm text-muted-foreground">불러오는 중…</p>}
        {!loading && choices.size === 0 && <p className="text-sm text-muted-foreground">저장된 프로젝트가 없습니다.</p>}
        {[...choices.values()].map(project => <Button key={project.id} variant="outline" className="justify-start" disabled={busy}
          onClick={() => onExisting(project.id)}><span className="truncate">{project.name}</span>{project.opened && <span className="ml-auto text-xs text-muted-foreground">열림</span>}</Button>)}
      </div>
    </DialogContent>
  </Dialog>;
}
