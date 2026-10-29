"use client";
import { useState } from "react";
import { Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { productionModeLabels, type ProductionRequest } from "@/domains/content-production/domain/start/input";
import { OPEN_DRAFT_MESSAGE } from "@/domains/content-production/domain/start-policy";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import type { Row } from "@/domains/content-production/domain/contracts";
import { RequestDialog } from "./request-dialog";

type Entry = { id: string; request: ProductionRequest };
function requestTitle(request: ProductionRequest, posts: PublishedPost[], references: Row[]) {
  if (request.mode === "past_post") return posts.find(post => post.id === request.sourceProjectId)?.name ?? "선택한 게시글";
  if (request.mode === "spy_reference") { const source = references.find(post => post.id === request.referenceId); return String(source?.title || source?.caption || "선택한 레퍼런스"); }
  if (request.mode === "external_url") return request.url;
  return "자동으로 주제 선정";
}
export function StartControls({ posts, references, busy, blockedByDraft, configured, syncing, error, onStart, onReload }: {
  posts: PublishedPost[]; references: Row[]; busy: boolean; blockedByDraft: boolean; configured: boolean | undefined; syncing: boolean;
  error: string; onStart: (requests: ProductionRequest[]) => Promise<unknown>; onReload: () => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const disabled = busy || starting || syncing || blockedByDraft || configured !== true;
  const selected = entries.find(entry => entry.id === editing);
  async function start() {
    if (disabled || !entries.length) return;
    setStarting(true); setStartError("");
    try { await onStart(entries.map(entry => entry.request)); setEntries([]); }
    catch (cause) { setStartError(cause instanceof Error ? cause.message : "제작 시작 실패"); }
    finally { setStarting(false); }
  }
  return <div className="space-y-3">
    {!!entries.length && <ol className="max-h-64 space-y-2 overflow-y-auto" aria-label="제작 요청 목록">
      {entries.map(({ id, request }, index) => {
        const title = requestTitle(request, posts, references);
        return <li key={id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{index + 1}. {productionModeLabels[request.mode]}</span>
            <div className="flex gap-1"><button type="button" className="production-button !p-1.5" aria-label={`${index + 1}번 요청 수정`} disabled={disabled} onClick={() => setEditing(id)}><Pencil size={13} /></button>
              <button type="button" className="production-button !p-1.5" aria-label={`${index + 1}번 요청 삭제`} disabled={disabled} onClick={() => setEntries(current => current.filter(entry => entry.id !== id))}><Trash2 size={13} /></button></div></div>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={title}>{title}</p>
          {request.instructions && <p className="mt-1 line-clamp-2 break-words text-xs">{request.instructions}</p>}
        </li>;
      })}
    </ol>}
    <div className="flex flex-col items-center gap-2 py-3">
      <button type="button" className="production-add-request" aria-label="제작 요청 추가" disabled={disabled} onClick={() => setEditing("new")}><Plus size={24} /></button>
      <span className="text-xs text-muted-foreground">제작 요청 추가</span>
    </div>
    <div className="flex gap-2">
      {!!entries.length && <button type="button" className="production-button primary flex-1" disabled={disabled} onClick={() => void start()}><Play size={14} />{starting || syncing ? "제작 준비 중…" : `${entries.length}개 제작 시작`}</button>}
      <button type="button" className="production-button ml-auto" aria-label="새로고침" disabled={starting} onClick={onReload}><RefreshCw size={14} /></button>
    </div>
    {blockedByDraft && <p className="text-xs leading-5 text-muted-foreground">{OPEN_DRAFT_MESSAGE}</p>}
    {(startError || error) && <p role="alert" className="text-xs text-destructive">{startError || error}</p>}
    {configured === false && <p role="alert" className="text-xs text-destructive">Apify 연결 설정이 필요합니다.</p>}
    {editing && <RequestDialog key={editing} initial={selected?.request} posts={posts} references={references} onClose={() => setEditing(null)} onSave={request => {
      setEntries(current => selected ? current.map(entry => entry.id === selected.id ? { ...entry, request } : entry) : [...current, { id: crypto.randomUUID(), request }]);
      setEditing(null);
    }} />}
  </div>;
}
