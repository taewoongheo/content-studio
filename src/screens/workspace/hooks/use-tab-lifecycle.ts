"use client";

import { useState } from "react";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";
import { getContentJob } from "@/screens/content-job/api";
import { renameProject } from "@/screens/projects/api";
import { closeTab, type CloseDecision } from "../api";
import type { WorkspaceOperation } from "./use-workspace-operation";

async function latestTab(tab: OpenProjectTab) {
  const job = await getContentJob(tab.projectId);
  if (job.tabId !== tab.tabId) throw new Error("이 탭은 이미 종료되었습니다.");
  return { ...tab, revision: job.editor.revision, name: job.name ?? tab.name };
}

/** Own the pending dialogs and server guards; the workspace owns navigation after close. */
export function useTabLifecycle({ activeTabId, flushPending, onClosed, run }: {
  activeTabId?: string;
  flushPending: () => Promise<void>;
  onClosed: (tab: OpenProjectTab) => Promise<void>;
  run: WorkspaceOperation;
}) {
  const [closing, setClosing] = useState<OpenProjectTab | null>(null);
  const [renaming, setRenaming] = useState<OpenProjectTab | null>(null);

  function reconcile(tabs: OpenProjectTab[]) {
    const ids = new Set(tabs.map(tab => tab.tabId));
    setClosing(previous => previous && ids.has(previous.tabId) ? previous : null);
    setRenaming(previous => previous && ids.has(previous.tabId) ? previous : null);
  }

  function close(tab: OpenProjectTab) {
    void run(async () => {
      if (activeTabId === tab.tabId) await flushPending();
      const target = await latestTab(tab);
      const { requiresConfirmation } = await closeTab(target);
      if (requiresConfirmation) setClosing(target);
      else await onClosed(target);
    });
  }

  function decideClose(decision: CloseDecision) {
    if (!closing) return;
    const target = closing;
    void run(async () => {
      try {
        await closeTab(target, decision);
      } catch (cause) {
        // Refresh the confirmation, but require another explicit choice for newer contents.
        const latest = await latestTab(target).catch(() => null);
        setClosing(latest);
        throw cause;
      }
      setClosing(null);
      await onClosed(target);
    });
  }

  function rename(name: string) {
    if (!renaming) return;
    const target = renaming;
    void run(async () => {
      if (activeTabId === target.tabId) await flushPending();
      await renameProject(target.projectId, name, target.tabId);
      setRenaming(null);
    });
  }

  return {
    closing, renaming, reconcile, close, decideClose, rename,
    requestRename: setRenaming,
    cancelClose: () => setClosing(null),
    cancelRename: () => setRenaming(null),
  };
}
