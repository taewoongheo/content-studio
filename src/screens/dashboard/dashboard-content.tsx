"use client";
import { SpyPage } from "./components/spy/spy-page";
import { ProductsPage } from "./components/products/products-page";
import { PersonaPage } from "./components/persona/persona-page";
import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { StudioSidebar } from "./components/studio-sidebar";
import { AllContentPage } from "./components/content/all-content-page";


export function DashboardContent({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (id: string) => Promise<void>;
}) {
  const [tab, setTab] = useState("all");
  return (
    <Tabs
      orientation="vertical"
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="min-h-[calc(100svh-2.75rem)] w-full"
    >
      <SidebarProvider
        open
        className="items-start bg-background text-foreground max-md:flex-col"
      >
        <a
          href="#main"
          className="fixed -top-16 left-4 z-50 rounded-lg border bg-background px-4 py-3 focus:top-4"
        >
          본문으로 이동
        </a>
        <StudioSidebar
          activeTab={tab}
          onOpenEditor={onNew}
          opening={false}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-12 pt-12 pb-16 outline-none max-xl:p-8 max-md:px-5 max-md:pt-6"
        >
          <TabsContent value="all" className="data-[hidden]:hidden">
            <AllContentPage onOpen={onOpen} />
          </TabsContent>
          <TabsContent value="spy" className="data-[hidden]:hidden"><SpyPage /></TabsContent>
          <TabsContent keepMounted value="products" className="data-[hidden]:hidden"><ProductsPage /></TabsContent>
          <TabsContent keepMounted value="persona" className="data-[hidden]:hidden"><PersonaPage /></TabsContent>
        </main>
      </SidebarProvider>
    </Tabs>
  );
}
