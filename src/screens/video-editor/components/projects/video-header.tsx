import { ArrowLeft, Download, LoaderCircle, Redo2, Save, Undo2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";
import type { VideoDocument } from "@/domains/video/domain/model";
import { videoDuration } from "@/domains/video/domain/model";
export function VideoHeader({ id, name, document: doc, disabled, dirty, saving, working, rendering, canUndo, canRedo, onBack, onChange, onSave, onUndo, onRedo, onImport, onMp4, onDelete }: {
  id: string; name: string; document: VideoDocument; disabled: boolean; dirty: boolean; saving: boolean; working: boolean; rendering: boolean; canUndo: boolean; canRedo: boolean;
  onBack: () => void; onChange: (doc: VideoDocument) => void; onSave: () => void; onUndo: () => void; onRedo: () => void; onImport: () => void; onMp4: () => void; onDelete: () => Promise<void>;
}) {
  return <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-3 py-1.5 sm:px-4">
    <div className="flex min-w-0 items-center gap-3"><Button variant="ghost" size="icon-sm" disabled={disabled || rendering} onClick={onBack} aria-label="새 작업으로 돌아가기"><ArrowLeft className="size-4" /></Button>
      <h1 className="truncate text-sm font-semibold">Content Studio <span className="font-normal text-muted-foreground">/ 영상 편집기</span></h1></div>
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <ProjectDeleteButton projectId={id} name={name} disabled={disabled || rendering} onDelete={onDelete} mediaLabel="미디어" />
      <label className="flex items-center gap-2 text-xs"><span className="sr-only">화면 비율</span><select aria-label="화면 비율" value={`${doc.width}:${doc.height}`} disabled={disabled}
        className="h-8 rounded-md border bg-background px-2" onChange={e => { const [width, height] = e.target.value.split(":").map(Number); onChange({ ...doc, width, height }); }}>
        <option value="1080:1350">4:5 · 1080 × 1350</option><option value="1080:1920">9:16 · 1080 × 1920</option><option value="1080:1080">1:1 · 1080 × 1080</option><option value="1920:1080">16:9 · 1920 × 1080</option>
      </select><span className="whitespace-nowrap">{(videoDuration(doc) / doc.fps).toFixed(1)}초</span></label>
      <Button type="button" variant="outline" size="sm" disabled={disabled || saving} onClick={onSave} title="저장 (Ctrl+S / ⌘S)">
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "저장 중" : dirty ? "저장" : "저장됨"}</Button>
      <Button size="sm" disabled={disabled || rendering} onClick={onMp4}>{rendering ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}MP4 내보내기</Button>
      <Button variant="outline" size="sm" disabled={disabled || rendering} onClick={onImport}><Upload className="size-4" />MP4 불러오기</Button>
      <Button variant="outline" size="sm" disabled={disabled || !canUndo} onClick={onUndo} title="되돌리기 (⌘Z)"><Undo2 className="size-4" />되돌리기</Button>
      <Button variant="outline" size="sm" disabled={disabled || !canRedo} onClick={onRedo} title="다시 실행 (⇧⌘Z)"><Redo2 className="size-4" />다시 실행</Button>
      {working && <span role="status" className="sr-only">처리 중…</span>}
    </div>
  </header>;
}
