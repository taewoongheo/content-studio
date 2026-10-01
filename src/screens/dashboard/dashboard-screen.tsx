"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import { useCodexConnection } from "@/lib/codex/use-codex-connection";
import { EditorScreen } from "@/screens/editor/editor-screen";
import { getContentJob } from "@/screens/content-job/api";
import { StudioSidebar } from "./components/studio-sidebar";
import { ProductContextForm } from "./components/product-context-form";
import { ContentForm } from "./components/content-form/content-form";
import { PublishedContentPage } from "./components/published/published-content-page";
import { AssetLibraryPage } from "./components/assets/asset-library-page";
import { SavedProjectsPage } from "./components/projects/saved-projects-page";
import { useProductContext } from "./hooks/use-product-context";
import { listContentProjects, loadContentProject } from "@/screens/projects/api";

export function DashboardScreen() {
  const [tab, setTab] = useState("create");
  const [job, setJob] = useState<ContentJobSnapshot | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>();
  const codex = useCodexConnection();
  const { context, loaded, storageError, saveContext } = useProductContext();

  useEffect(() => {
    const jobId = new URL(window.location.href).searchParams.get("job");
    if (!jobId || !codex.selectedModel) return;
    const currentJob = getContentJob(jobId);
    const projects = listContentProjects();
    void Promise.allSettled([currentJob, projects]).then(async ([jobResult, projectsResult]) => {
      const saved = projectsResult.status === "fulfilled"
        ? projectsResult.value.find((project) => project.id === jobId)
        : undefined;
      if (jobResult.status === "fulfilled") {
        setJob(jobResult.value);
        setProjectName(saved?.name);
        return;
      }
      if (saved) {
        try {
          setJob(await loadContentProject(saved.id, codex.selectedModel));
          setProjectName(saved.name);
          return;
        } catch { /* Remove an unavailable project URL below. */ }
      }
      {
        const url = new URL(window.location.href);
        url.searchParams.delete("job");
        window.history.replaceState(null, "", url);
      }
    });
  }, [codex.selectedModel]);

  function showJob(nextJob: ContentJobSnapshot, savedName?: string) {
    setJob(nextJob);
    setProjectName(savedName);
    setTab("create");
    const url = new URL(window.location.href);
    url.searchParams.set("job", nextJob.id);
    window.history.replaceState(null, "", url);
  }

  function startNewJob() {
    setJob(null);
    setProjectName(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("job");
    window.history.replaceState(null, "", url);
  }
  if (job) return <EditorScreen initialJob={job} initialProjectName={projectName} onNewJob={startNewJob} />;
  return (
    <Tabs
      orientation="vertical"
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="min-h-svh w-full"
    >
      <SidebarProvider
        open
        className={
          "items-start bg-background text-foreground max-md:flex-col [&_button]:touch-manipulation [&_a]:touch-manipulation [&_input]:touch-manipulation [&_textarea]:touch-manipulation [&_select]:touch-manipulation motion-reduce:[&_*]:transition-none motion-reduce:[&_*]:animate-none"
        }
      >
        <a
          href="#main"
          className={
            "fixed -top-16 left-4 z-50 rounded-lg border bg-background px-4 py-3 focus:top-4"
          }
        >
          본문으로 이동
        </a>
        <StudioSidebar activeTab={tab} codex={codex} />
        <main
          id="main"
          className={
            "mx-auto w-full min-w-0 max-w-[1080px] flex-1 px-12 pt-12 pb-16 outline-none max-xl:p-8 max-md:px-5 max-md:pt-6 max-md:pb-12"
          }
          tabIndex={-1}
        >
          {!loaded ? (
            <p role="status" className="text-sm text-muted-foreground">
              제품 컨텍스트를 불러오는 중…
            </p>
          ) : (
            <>
              {storageError && (
                <p
                  role="alert"
                  className={"my-2 text-sm leading-relaxed text-destructive"}
                >
                  {storageError}
                </p>
              )}
              <TabsContent
                value="create"
                keepMounted
                className="data-[hidden]:hidden"
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    새 콘텐츠 만들기
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    슬라이드 구성과 레퍼런스를 선택하고 제작 조건을 설정하세요.
                  </p>
                </div>
                <ContentForm
                  context={context}
                  codexModel={codex.selectedModel}
                  onRegisterContext={() => setTab("products")}
                  onJobStarted={showJob}
                />
              </TabsContent>
              <TabsContent
                value="products"
                keepMounted
                className="data-[hidden]:hidden"
              >
                <div className={"mb-8"}>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    제품 컨텍스트
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    콘텐츠 제작에 공통으로 사용할 제품 정보를 등록하고
                    관리하세요.
                  </p>
                </div>
                <ProductContextForm
                  context={context}
                  onSave={saveContext}
                  onCreate={() => setTab("create")}
                />
              </TabsContent>
            </>
          )}
          <TabsContent value="published" className="data-[hidden]:hidden">
            <PublishedContentPage />
          </TabsContent>
          <TabsContent value="projects" className="data-[hidden]:hidden">
            <SavedProjectsPage codexModel={codex.selectedModel} onOpen={showJob} />
          </TabsContent>
          <TabsContent value="assets" className="data-[hidden]:hidden">
            <AssetLibraryPage />
          </TabsContent>
        </main>
      </SidebarProvider>
    </Tabs>
  );
}
