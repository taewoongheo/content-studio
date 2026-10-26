"use client";
import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PublishDialog({ onClose, onPublish }: {
  onClose: () => void;
  onPublish: (url: string) => Promise<unknown>;
}) {
  const [url, setUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (publishing) return;
    setPublishing(true); setError("");
    try { await onPublish(url); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "게시 확인 실패"); }
    finally { setPublishing(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !publishing) onClose(); }}>
    <DialogContent showCloseButton={!publishing}>
      <DialogHeader><DialogTitle>게시 완료</DialogTitle><DialogDescription>업로드한 TikTok 게시물 URL을 등록하세요.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <label htmlFor="publish-url" className="block text-sm font-medium">TikTok 게시물 URL</label>
        <input autoFocus id="publish-url" name="post_url" type="url" className="production-field" value={url} onChange={event => setUrl(event.target.value)} required disabled={publishing} placeholder="https://www.tiktok.com/@.../photo/..." />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="production-button" onClick={onClose} disabled={publishing}>취소</button>
          <button className="production-button primary" disabled={publishing}>{publishing ? "게시 확인 중…" : "완료"}</button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
