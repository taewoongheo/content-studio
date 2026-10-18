"use client";
import dynamic from "next/dynamic";
import { createVideoProject, openVideoProject, listVideoProjects } from "@/domains/video/client/api";
import type { VideoSnapshot } from "@/domains/video/domain/model";
import type { VideoEditorWorkspaceHandle } from "@/screens/video-editor/video-editor-screen";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { OpenProjectTab } from "@/domains/workspace/model";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { DashboardContent } from "@/screens/dashboard/dashboard-content";
import { SlideshowEditorScreen, type SlideshowEditorViewState, type SlideshowEditorWorkspaceHandle } from "@/screens/slideshow-editor/slideshow-editor-screen";
import { createContentJob } from "@/domains/slideshow/client/editor/api";
import { loadContentProject } from "@/domains/slideshow/client/projects-api";
import { useOpenTabs } from "./hooks/use-open-tabs";
import { useWorkspaceOperation } from "./hooks/use-workspace-operation";
import { useTabLifecycle } from "./hooks/use-tab-lifecycle";
import { ProjectTabs } from "./components/project-tabs";
import { CloseTabDialog } from "./components/close-tab-dialog";
import { RenameTabDialog } from "./components/rename-tab-dialog";
import { NewTabDialog } from "./components/new-tab-dialog";
import { adjacentTab, workspaceShortcut } from "./shortcuts/workspace-shortcut";

const VideoEditorScreen = dynamic(() => import("@/screens/video-editor/video-editor-screen").then(m => m.VideoEditorScreen), { ssr: false, loading: () => <p className="p-6 text-sm">영상 편집기 불러오는 중…</p> });

function updateUrl(projectId: string | null, replace = false, type?: "video") {
  const url = new URL(window.location.href);
  if (projectId) url.searchParams.set("job", projectId); else url.searchParams.delete("job");
  if (type) url.searchParams.set("type", type); else url.searchParams.delete("type");
  if (url.href !== window.location.href) window.history[replace ? "replaceState" : "pushState"](null, "", url);
}

export function WorkspaceScreen() {
  const [video, setVideo] = useState<VideoSnapshot | null>(null);
  const videoEditor = useRef<VideoEditorWorkspaceHandle>(null);
  const currentVideo = useRef(video);
  const [job, setJob] = useState<ContentJobSnapshot | null>(null);
  const [initialViewState, setInitialViewState] = useState<SlideshowEditorViewState>();
  const { busy, error, setError, run } = useWorkspaceOperation();
  const [chooser, setChooser] = useState(false);
  const editor = useRef<SlideshowEditorWorkspaceHandle>(null);
  const views = useRef(new Map<string, SlideshowEditorViewState>());
  const current = useRef(job);
  useEffect(() => { current.current = job; }, [job]);

  const lifecycle = useTabLifecycle({ activeTabId: job?.tabId ?? video?.tabId, flushPending: prepareSwitch, onClosed: finishClose, run });
  const { tabs, error: connectionError } = useOpenTabs(next => {
    lifecycle.reconcile(next);
    const openIds = new Set(next.map(tab => tab.tabId));
    for (const id of views.current.keys()) if (!openIds.has(id)) views.current.delete(id);
    const v = currentVideo.current;
    const remoteVideo = v && next.find(tab => tab.tabId === v.tabId);
    if (remoteVideo) void videoEditor.current?.sync(remoteVideo.revision, remoteVideo.name);
    if (v && !openIds.has(v.tabId)) { currentVideo.current = null; setVideo(null); updateUrl(null, true); }
    const active = current.current;
    if (active && !openIds.has(active.tabId)) {
      current.current = null; setJob(null); setInitialViewState(undefined); updateUrl(null, true);
    }
  });

  async function prepareSwitch() {
    if (currentVideo.current) {
      if (!videoEditor.current) throw new Error("영상 편집기를 불러오는 중입니다.");
      if (!await videoEditor.current.flushPending()) throw new Error("영상을 저장하지 못했습니다. 현재 탭을 확인해 주세요.");
    }
    if (!editor.current) return;
    if (!(await editor.current.flushPending())) throw new Error("입력 중인 변경을 반영하지 못했습니다. 현재 탭을 확인해 주세요.");
    if (current.current) views.current.set(current.current.tabId, editor.current.getViewState());
  }

  async function showProject(projectId: string, replace = false) {
    const known = tabs?.find(t => t.projectId === projectId);
    const isVideo = known ? known.projectType === "video" : (await listVideoProjects()).some(p => p.id === projectId);
    if (isVideo) { const next = await openVideoProject(projectId); currentVideo.current = next; setVideo(next); current.current = null; setJob(null); setChooser(false); updateUrl(next.id, replace, "video"); return; }
    const next = await loadContentProject(projectId);
    currentVideo.current = null; setVideo(null);
    current.current = next; setJob(next); setInitialViewState(views.current.get(next.tabId)); setChooser(false); updateUrl(next.id, replace);
  }
  async function select(projectId: string) {
    if (job?.id === projectId || video?.id === projectId) { setChooser(false); return; }
    await run(async () => { await prepareSwitch(); await showProject(projectId); });
  }
  const handleWorkspaceShortcut = useEffectEvent((event: KeyboardEvent) => {
    const shortcut = workspaceShortcut(event);
    if (!shortcut || event.defaultPrevented) return;
    const activeTab = tabs?.find(tab => tab.tabId === (job?.tabId ?? video?.tabId));
    if (!activeTab) return;
    // Reserve workspace shortcuts even while blocked, so a dialog or pending save cannot close the browser or navigate its history.
    event.preventDefault();
    if (event.repeat || busy || chooser || lifecycle.closing || lifecycle.renaming ||
      document.querySelector("[role='dialog'], [role='alertdialog']")) return;
    if (shortcut === "close") lifecycle.close(activeTab);
    else {
      const neighbor = adjacentTab(tabs ?? [], activeTab.tabId, shortcut);
      if (neighbor) void select(neighbor.projectId);
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleWorkspaceShortcut(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);

  function dashboard() {
    void run(async () => { await prepareSwitch(); currentVideo.current = null; setVideo(null); current.current = null; setJob(null); updateUrl(null); });
  }
  function create(type: "slideshow" | "video") {
    void run(async () => {
      await prepareSwitch();
      if (type === "video") { const next = await createVideoProject(); currentVideo.current = next; setVideo(next); current.current = null; setJob(null); setChooser(false); updateUrl(next.id, false, "video"); return; }
      const next = await createContentJob();
      currentVideo.current = null; setVideo(null);
      current.current = next; setJob(next); setInitialViewState(undefined); setChooser(false); updateUrl(next.id);
    });
  }
  async function finishClose(tab: OpenProjectTab) {
    views.current.delete(tab.tabId);
    if (job?.tabId === tab.tabId || video?.tabId === tab.tabId) {
      const index = tabs?.findIndex(item => item.tabId === tab.tabId) ?? -1;
      const neighbor = tabs?.[index + 1] ?? tabs?.[index - 1];
      current.current = null; setJob(null); currentVideo.current = null; setVideo(null);
      if (neighbor) await showProject(neighbor.projectId); else updateUrl(null);
    }
  }
  useEffect(() => {
    let active = true;
    const restore = async () => {
      const id = new URL(window.location.href).searchParams.get("job");
      try {
        if (id && new URL(window.location.href).searchParams.get("type") === "video") {
          const next = await openVideoProject(id);
          if (active) { currentVideo.current = next; setVideo(next); current.current = null; setJob(null); }
          return;
        }
        const next = id ? await loadContentProject(id) : null;
        if (active) { currentVideo.current = null; setVideo(null); }
        if (active) { current.current = next; setJob(next); setInitialViewState(next ? views.current.get(next.tabId) : undefined); }
      } catch (cause) {
        if (active) { setError(cause instanceof Error ? cause.message : "탭을 열지 못했습니다."); updateUrl(null, true); }
      }
    };
    void restore();
    const pop = () => { void run(async () => {
      const previousVideo = currentVideo.current;
      if (previousVideo && videoEditor.current && !await videoEditor.current.flushPending()) { updateUrl(previousVideo.id, true, "video"); throw new Error("영상을 저장하지 못했습니다."); }
      const previous = current.current;
      if (editor.current && !(await editor.current.flushPending())) { updateUrl(previous?.id ?? null, true); throw new Error("현재 입력을 반영하지 못했습니다."); }
      if (previous && editor.current) views.current.set(previous.tabId, editor.current.getViewState());
      await restore();
    }); };
    window.addEventListener("popstate", pop);
    return () => { active = false; window.removeEventListener("popstate", pop); };
  }, [run, setError]);


  return <div className="flex h-svh min-h-0 flex-col bg-background text-foreground">
    <ProjectTabs tabs={tabs ?? []} activeTabId={job?.tabId ?? video?.tabId} busy={busy}
      onSelect={tab => select(tab.projectId)} onClose={lifecycle.close} onRename={tab => { setError(""); lifecycle.requestRename(tab); }} onNew={() => setChooser(true)} onDashboard={dashboard} />
    {(error || connectionError) && <p role="alert" className="shrink-0 border-b px-4 py-2 text-sm text-destructive">{error || connectionError}</p>}
    <div className="relative min-h-0 flex-1 overflow-auto">
      {busy && <div className="absolute inset-0 z-40 cursor-wait bg-background/20" aria-label="탭 처리 중" />}
      {video ? <VideoEditorScreen key={video.tabId} ref={videoEditor} initial={video} onNewJob={dashboard} /> : job ? <SlideshowEditorScreen key={job.tabId} ref={editor} initialJob={job}
        initialViewState={initialViewState} onNewJob={dashboard} />
        : <DashboardContent onOpen={select} onNew={() => setChooser(true)} />}
    </div>
    {lifecycle.closing && <CloseTabDialog tab={lifecycle.closing} busy={busy} error={error} onCancel={lifecycle.cancelClose} onDecision={lifecycle.decideClose} />}
    {lifecycle.renaming && <RenameTabDialog key={lifecycle.renaming.tabId} tab={lifecycle.renaming} busy={busy} error={error} onCancel={lifecycle.cancelRename} onRename={lifecycle.rename} />}
    <NewTabDialog tabs={tabs ?? []} open={chooser} busy={busy} onOpenChange={setChooser} onNew={create} onExisting={select} />
  </div>;
}
