"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentJobSnapshot, OpenProjectTab } from "@/lib/content-jobs/domain/types";
import { DashboardContent } from "@/screens/dashboard/dashboard-content";
import { EditorScreen, type EditorViewState, type EditorWorkspaceHandle } from "@/screens/editor/editor-screen";
import { createContentJob, getContentJob } from "@/screens/content-job/api";
import { loadContentProject, renameProject } from "@/screens/projects/api";
import { useOpenTabs } from "./use-open-tabs";
import { closeTab } from "./api";
import { ProjectTabs } from "./components/project-tabs";
import { CloseTabDialog } from "./components/close-tab-dialog";
import { RenameTabDialog } from "./components/rename-tab-dialog";
import { NewTabDialog } from "./components/new-tab-dialog";

function updateUrl(projectId: string | null, replace = false) {
  const url = new URL(window.location.href);
  if (projectId) url.searchParams.set("job", projectId); else url.searchParams.delete("job");
  if (url.href !== window.location.href) window.history[replace ? "replaceState" : "pushState"](null, "", url);
}

export function WorkspaceScreen() {
  const [job, setJob] = useState<ContentJobSnapshot | null>(null);
  const [initialViewState, setInitialViewState] = useState<EditorViewState>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closing, setClosing] = useState<OpenProjectTab | null>(null);
  const [renaming, setRenaming] = useState<OpenProjectTab | null>(null);
  const [chooser, setChooser] = useState(false);
  const editor = useRef<EditorWorkspaceHandle>(null);
  const views = useRef(new Map<string, EditorViewState>());
  const running = useRef(false);
  const current = useRef(job);
  useEffect(() => { current.current = job; }, [job]);

  const { tabs, error: connectionError } = useOpenTabs(next => {
    setClosing(previous => previous && next.some(tab => tab.tabId === previous.tabId) ? previous : null);
    setRenaming(previous => previous && next.some(tab => tab.tabId === previous.tabId) ? previous : null);
    const active = current.current;
    if (active && !next.some(tab => tab.tabId === active.tabId)) {
      views.current.delete(active.tabId);
      current.current = null; setJob(null); setInitialViewState(undefined); updateUrl(null, true);
    }
  });

  const run = useCallback(async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try { await operation(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "탭을 변경하지 못했습니다."); }
    finally { running.current = false; setBusy(false); }
  }, []);

  async function prepareSwitch() {
    if (!editor.current) return;
    if (!(await editor.current.flushPending())) throw new Error("입력 중인 변경을 반영하지 못했습니다. 현재 탭을 확인해 주세요.");
    if (current.current) views.current.set(current.current.tabId, editor.current.getViewState());
  }

  async function showProject(projectId: string, replace = false) {
    const next = await loadContentProject(projectId);
    current.current = next; setJob(next); setInitialViewState(views.current.get(next.tabId)); setChooser(false); updateUrl(next.id, replace);
  }
  function select(projectId: string) {
    if (job?.id === projectId) { setChooser(false); return; }
    void run(async () => { await prepareSwitch(); await showProject(projectId); });
  }
  function dashboard() {
    void run(async () => { await prepareSwitch(); current.current = null; setJob(null); updateUrl(null); });
  }
  function create() {
    void run(async () => {
      await prepareSwitch();
      const next = await createContentJob();
      current.current = next; setJob(next); setInitialViewState(undefined); setChooser(false); updateUrl(next.id);
    });
  }
  async function finishClose(tab: OpenProjectTab) {
    setClosing(null);
    views.current.delete(tab.tabId);
    if (job?.tabId === tab.tabId) {
      const index = tabs?.findIndex(item => item.tabId === tab.tabId) ?? -1;
      const neighbor = tabs?.[index + 1] ?? tabs?.[index - 1];
      current.current = null; setJob(null);
      if (neighbor) await showProject(neighbor.projectId); else updateUrl(null);
    }
  }
  function close(tab: OpenProjectTab) {
    void run(async () => {
      if (job?.tabId === tab.tabId) await prepareSwitch();
      const latest = await getContentJob(tab.projectId);
      if (latest.tabId !== tab.tabId) throw new Error("이 탭은 이미 종료되었습니다.");
      const target = { ...tab, revision: latest.editor.revision, name: latest.name ?? tab.name };
      if (await closeTab(target)) setClosing(target);
      else await finishClose(target);
    });
  }
  function decideClose(decision: "save" | "discard") {
    if (!closing) return;
    void run(async () => {
      try { await closeTab(closing, decision); }
      catch (cause) {
        const latest = await getContentJob(closing.projectId).catch(() => null);
        if (latest?.tabId === closing.tabId) setClosing({ ...closing, revision: latest.editor.revision, name: latest.name ?? closing.name });
        else setClosing(null);
        throw cause;
      }
      await finishClose(closing);
    });
  }
  function rename(name: string) {
    if (!renaming) return;
    void run(async () => {
      if (job?.tabId === renaming.tabId) await prepareSwitch();
      await renameProject(renaming.projectId, name, renaming.tabId);
      setRenaming(null);
    });
  }

  useEffect(() => {
    let active = true;
    const restore = async () => {
      const id = new URL(window.location.href).searchParams.get("job");
      try {
        const next = id ? await loadContentProject(id) : null;
        if (active) { current.current = next; setJob(next); setInitialViewState(next ? views.current.get(next.tabId) : undefined); }
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "탭을 열지 못했습니다."); updateUrl(null, true); }
      }
    };
    void restore();
    const pop = () => { void run(async () => {
      const previous = current.current;
      if (editor.current && !(await editor.current.flushPending())) { updateUrl(previous?.id ?? null, true); throw new Error("현재 입력을 반영하지 못했습니다."); }
      if (previous && editor.current) views.current.set(previous.tabId, editor.current.getViewState());
      await restore();
    }); };
    window.addEventListener("popstate", pop);
    return () => { active = false; window.removeEventListener("popstate", pop); };
  }, [run]);


  return <div className="flex h-svh min-h-0 flex-col bg-background text-foreground">
    <ProjectTabs tabs={tabs ?? []} activeTabId={job?.tabId} busy={busy}
      onSelect={tab => select(tab.projectId)} onClose={close} onRename={tab => { setError(""); setRenaming(tab); }} onNew={() => setChooser(true)} onDashboard={dashboard} />
    {(error || connectionError) && <p role="alert" className="shrink-0 border-b px-4 py-2 text-sm text-destructive">{error || connectionError}</p>}
    <div className="relative min-h-0 flex-1 overflow-auto">
      {busy && <div className="absolute inset-0 z-40 cursor-wait bg-background/20" aria-label="탭 처리 중" />}
      {job ? <EditorScreen key={job.tabId} ref={editor} initialJob={job} initialProjectName={job.savedRevision !== undefined ? job.name : undefined}
        initialViewState={initialViewState} onNewJob={dashboard} />
        : <DashboardContent onOpen={next => select(next.id)} onNew={() => setChooser(true)} />}
    </div>
    {closing && <CloseTabDialog tab={closing} busy={busy} error={error} onCancel={() => setClosing(null)} onDecision={decideClose} />}
    {renaming && <RenameTabDialog key={renaming.tabId} tab={renaming} busy={busy} error={error} onCancel={() => setRenaming(null)} onRename={rename} />}
    <NewTabDialog tabs={tabs ?? []} open={chooser} busy={busy} onOpenChange={setChooser} onNew={create} onExisting={select} />
  </div>;
}
