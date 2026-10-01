"use client";

import { CodexConnection } from "./codex-connection";
import { CalendarDays, FolderOpen, Images, Package, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CodexConnectionController } from "@/lib/codex/use-codex-connection";

export function StudioSidebar({
  activeTab,
  codex,
}: {
  activeTab: string;
  codex: CodexConnectionController;
}) {
  return (
    <Sidebar
      collapsible="none"
      className={
        "sticky top-0 h-svh w-64 shrink-0 border-r max-md:static max-md:h-auto max-md:w-full max-md:border-r-0 max-md:border-b"
      }
      aria-label="워크스페이스"
    >
      <SidebarHeader className="px-6 py-7">
        <span className="text-base font-semibold tracking-tight">
          Content Studio
        </span>
      </SidebarHeader>
      <SidebarContent className="px-3 pb-4">
        <TabsList
          aria-label="워크스페이스"
          className="!h-auto w-full items-stretch gap-1 bg-transparent p-0"
        >
          <SidebarMenuButton
            className="h-11"
            isActive={activeTab === "products"}
            render={
              <TabsTrigger
                value="products"
                className="!h-11 !flex-none justify-start px-3 !shadow-none data-active:!bg-accent"
              />
            }
          >
            <Package aria-hidden="true" />
            <span>제품 컨텍스트</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            className="h-11"
            isActive={activeTab === "create"}
            render={
              <TabsTrigger
                value="create"
                className="!h-11 !flex-none justify-start px-3 !shadow-none data-active:!bg-accent"
              />
            }
          >
            <Plus aria-hidden="true" />
            <span>새 콘텐츠 만들기</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            className="h-11"
            isActive={activeTab === "published"}
            render={<TabsTrigger value="published" className="!h-11 !flex-none justify-start px-3 !shadow-none data-active:!bg-accent" />}
          >
            <CalendarDays aria-hidden="true" />
            <span>게시 콘텐츠</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            className="h-11"
            isActive={activeTab === "projects"}
            render={<TabsTrigger value="projects" className="!h-11 !flex-none justify-start px-3 !shadow-none data-active:!bg-accent" />}
          >
            <FolderOpen aria-hidden="true" />
            <span>저장된 프로젝트</span>
          </SidebarMenuButton>
          <SidebarMenuButton
            className="h-11"
            isActive={activeTab === "assets"}
            render={<TabsTrigger value="assets" className="!h-11 !flex-none justify-start px-3 !shadow-none data-active:!bg-accent" />}
          >
            <Images aria-hidden="true" />
            <span>이미지 에셋</span>
          </SidebarMenuButton>
        </TabsList>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <CodexConnection controller={codex} />
      </SidebarFooter>
    </Sidebar>
  );
}
