"use client";
import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import { EditorScreen } from "@/screens/editor/editor-screen";
import { createContentJob, getContentJob } from "@/screens/content-job/api";
import { listContentProjects, loadContentProject } from "@/screens/projects/api";
import { StudioSidebar } from "./components/studio-sidebar";
import { PublishedContentPage } from "./components/published/published-content-page";
import { AssetLibraryPage } from "./components/assets/asset-library-page";
import { SavedProjectsPage } from "./components/projects/saved-projects-page";

export function DashboardScreen() {
  const [tab, setTab] = useState("projects");
  const [job, setJob] = useState<ContentJobSnapshot | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let active = true;
    const jobId = new URL(window.location.href).searchParams.get("job");
    if (!jobId) return;
    void Promise.allSettled([getContentJob(jobId), listContentProjects()]).then(async ([jobResult, projectsResult]) => {
      const saved = projectsResult.status === "fulfilled"
        ? projectsResult.value.find((project) => project.id === jobId) : undefined;
      try {
        const restored = jobResult.status === "fulfilled" ? jobResult.value
          : saved ? await loadContentProject(saved.id) : null;
        if (!active) return;
        if (restored) { setJob(restored); setProjectName(saved?.name); }
        else {
          setError("작업을 찾을 수 없습니다. 저장된 프로젝트를 다시 열어 주세요.");
          const url = new URL(window.location.href);
          url.searchParams.delete("job");
          window.history.replaceState(null, "", url);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "프로젝트를 불러오지 못했습니다.");
      } finally { if (active) setOpening(false); }
    });
    return () => { active = false; };
  }, []);

  function showJob(next: ContentJobSnapshot, savedName?: string) {
    setJob(next); setProjectName(savedName); setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("job", next.id);
    window.history.replaceState(null, "", url);
  }
  async function openEditor() {
    setOpening(true); setError("");
    try { showJob(await createContentJob()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "편집기를 열지 못했습니다."); }
    finally { setOpening(false); }
  }
  function startNewJob() {
    setJob(null); setProjectName(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("job");
    window.history.replaceState(null, "", url);
  }
  if (job) return <EditorScreen key={job.id} initialJob={job} initialProjectName={projectName} onNewJob={startNewJob} />;
  return (
    <Tabs orientation="vertical" value={tab} onValueChange={(value) => setTab(String(value))} className="min-h-svh w-full">
      <SidebarProvider open className="items-start bg-background text-foreground max-md:flex-col">
        <a href="#main" className="fixed -top-16 left-4 z-50 rounded-lg border bg-background px-4 py-3 focus:top-4">본문으로 이동</a>
        <StudioSidebar activeTab={tab} onOpenEditor={() => { void openEditor(); }} opening={opening} />
        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1080px] flex-1 px-12 pt-12 pb-16 outline-none max-xl:p-8 max-md:px-5 max-md:pt-6">
          {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
          {opening && <p role="status" className="mb-4 text-sm text-muted-foreground">프로젝트를 불러오는 중…</p>}
          <TabsContent value="published" className="data-[hidden]:hidden"><PublishedContentPage /></TabsContent>
          <TabsContent value="projects" className="data-[hidden]:hidden"><SavedProjectsPage onOpen={showJob} /></TabsContent>
          <TabsContent value="assets" className="data-[hidden]:hidden"><AssetLibraryPage /></TabsContent>
        </main>
      </SidebarProvider>
    </Tabs>
  );
}
