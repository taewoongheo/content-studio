import { Copy, FolderOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectTypeTag } from "@/screens/projects/components/project-type-tag";
import type { VideoSummary } from "@/lib/video/domain/model";
import { videoEndpoint, videoRequest, deleteVideoProject } from "../api";
export function VideoProjectCard({ project, busy, onOpen, run }: { project: VideoSummary; busy: boolean; onOpen: (id: string) => void; run: (work: () => Promise<unknown>) => Promise<void> }) {
  return <article role="listitem" className="grid min-w-0 gap-4 py-5">
    <div className="min-w-0"><div className="flex items-start gap-2"><h3 className="min-w-0 break-words font-medium">{project.name}</h3><ProjectTypeTag type="video" /></div>
      <p className="mt-1.5 text-xs text-muted-foreground">{project.width} × {project.height} · {(project.duration / project.fps).toFixed(1)}초 · {project.fps}fps</p></div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpen(project.id)}><FolderOpen />열기</Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(() => videoRequest(videoEndpoint(project.id), "POST", { action: "clone" }))}><Copy />복제</Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => { if (window.confirm(`“${project.name}” 영상을 삭제할까요? 영상과 저장된 미디어가 함께 삭제됩니다.`)) void run(() => deleteVideoProject(project)); }}><Trash2 />삭제</Button>
    </div>
  </article>;
}
