"use client";
import { Plus, LayoutDashboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";

export function ProjectTabs({ tabs, activeTabId, busy, onSelect, onClose, onNew, onDashboard }: {
  tabs: OpenProjectTab[]; activeTabId?: string; busy: boolean;
  onSelect: (tab: OpenProjectTab) => void; onClose: (tab: OpenProjectTab) => void;
  onNew: () => void; onDashboard: () => void;
}) {
  return <nav aria-label="프로젝트 탭" className="flex h-11 shrink-0 items-center gap-1 border-b bg-muted/30 px-2">
    <Button variant="ghost" size="icon-sm" aria-label="대시보드" disabled={busy} onClick={onDashboard}><LayoutDashboard className="size-4" /></Button>
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {tabs.map(tab => <div key={tab.tabId} className={`flex shrink-0 items-center rounded-md border ${activeTabId === tab.tabId ? "border-border bg-background" : "border-transparent"}`}>
        <button type="button" aria-label={tab.name} aria-describedby={tab.savedRevision !== tab.revision ? `unsaved-${tab.tabId}` : undefined}
          aria-current={activeTabId === tab.tabId ? "page" : undefined} disabled={busy}
          onClick={() => onSelect(tab)} className="flex h-8 max-w-52 items-center gap-2 px-3 text-xs disabled:opacity-50">
          <span className="truncate">{tab.name}</span>
          {tab.savedRevision !== tab.revision && <>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-foreground" />
            <span id={`unsaved-${tab.tabId}`} className="sr-only">저장되지 않은 변경</span>
          </>}
        </button>
        <Button variant="ghost" size="icon-sm" aria-label={`${tab.name} 탭 닫기`} disabled={busy} onClick={() => onClose(tab)}><X className="size-3" /></Button>
      </div>)}
    </div>
    <Button variant="ghost" size="icon-sm" aria-label="새 탭" disabled={busy} onClick={onNew}><Plus className="size-4" /></Button>
  </nav>;
}
