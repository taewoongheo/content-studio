"use client";

import { CalendarDays, FolderOpen, Images, Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StudioSidebar({
  activeTab,
  onOpenEditor,
  opening,
}: {
  activeTab: string;
  onOpenEditor: () => void;
  opening: boolean;
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
            onClick={onOpenEditor}
            disabled={opening}
          >
            <Plus aria-hidden="true" />
            <span>편집기 열기</span>
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
    </Sidebar>
  );
}
