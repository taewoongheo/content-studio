"use client";
import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { StudioSidebar } from "./components/studio-sidebar";
import { PublishedContentPage } from "./components/published/published-content-page";
import { SavedProjectsPage } from "./components/projects/saved-projects-page";

export function DashboardContent({ onOpen, onNew }: {
  onOpen: (projectId: string) => Promise<void>; onNew: () => void;
}) {
  const [tab, setTab] = useState("projects");
  return (
    <Tabs orientation="vertical" value={tab} onValueChange={(value) => setTab(String(value))} className="min-h-[calc(100svh-2.75rem)] w-full">
      <SidebarProvider open className="items-start bg-background text-foreground max-md:flex-col">
        <a href="#main" className="fixed -top-16 left-4 z-50 rounded-lg border bg-background px-4 py-3 focus:top-4">본문으로 이동</a>
        <StudioSidebar activeTab={tab} onOpenEditor={onNew} opening={false} />
        <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1080px] flex-1 px-12 pt-12 pb-16 outline-none max-xl:p-8 max-md:px-5 max-md:pt-6">
          <TabsContent value="published" className="data-[hidden]:hidden"><PublishedContentPage /></TabsContent>
          <TabsContent value="projects" className="data-[hidden]:hidden"><SavedProjectsPage onOpen={onOpen} /></TabsContent>
        </main>
      </SidebarProvider>
    </Tabs>
  );
}
