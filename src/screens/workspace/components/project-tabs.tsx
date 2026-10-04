"use client";
import { Plus, LayoutDashboard, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";

export function ProjectTabs({ tabs, activeTabId, busy, onSelect, onClose, onRename, onNew, onDashboard }: {
  tabs: OpenProjectTab[]; activeTabId?: string; busy: boolean;
  onSelect: (tab: OpenProjectTab) => void; onClose: (tab: OpenProjectTab) => void; onRename: (tab: OpenProjectTab) => void;
  onNew: () => void; onDashboard: () => void;
}) {
  return <nav aria-label="프로젝트 탭" className="flex h-11 shrink-0 items-end border-b bg-muted px-2">
    <Button variant="ghost" size="icon-sm" className="mb-1 mr-1 shrink-0" aria-label="대시보드" disabled={busy} onClick={onDashboard}><LayoutDashboard className="size-4" /></Button>
    <div className="flex h-full min-w-0 flex-1 items-end overflow-x-auto">
      {tabs.map(tab => <div data-project-tab={tab.tabId} key={tab.tabId}
        className={`group relative -mb-px flex h-10 w-52 shrink-0 items-center rounded-t-lg border ${activeTabId === tab.tabId ? "border-b-background bg-background" : "border-b-muted bg-muted hover:bg-background/50"}`}>
        <button type="button" aria-label={tab.name} aria-describedby={(tab.savedRevision ?? 0) !== tab.revision ? `unsaved-${tab.tabId}` : undefined}
          aria-current={activeTabId === tab.tabId ? "page" : undefined} disabled={busy}
          title="더블 클릭 또는 F2로 프로젝트 이름 변경"
          onClick={() => onSelect(tab)} onDoubleClick={() => onRename(tab)}
          onKeyDown={event => { if (event.key === "F2") { event.preventDefault(); onRename(tab); } }}
          className="flex h-full min-w-0 flex-1 items-center gap-2 px-3 text-xs disabled:opacity-50">
          <span className="truncate">{tab.name}</span>
          {(tab.savedRevision ?? 0) !== tab.revision && <>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />
            <span id={`unsaved-${tab.tabId}`} className="sr-only">저장되지 않은 변경</span>
          </>}
        </button>
        <Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={`${tab.name} 이름 변경`} disabled={busy} onClick={() => onRename(tab)}><Pencil className="size-3" /></Button>
        <Button variant="ghost" size="icon-sm" className="mr-1 shrink-0" aria-label={`${tab.name} 탭 닫기`} aria-keyshortcuts={activeTabId === tab.tabId ? "Meta+W" : undefined}
          title={activeTabId === tab.tabId ? "탭 닫기 (⌘W)" : "탭 닫기"} disabled={busy} onClick={() => onClose(tab)}><X className="size-3" /></Button>
      </div>)}
      <Button variant="ghost" size="icon-sm" className="mb-1 ml-1 shrink-0" aria-label="새 탭" disabled={busy} onClick={onNew}><Plus className="size-4" /></Button>
    </div>
  </nav>;
}
