"use client";

import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { StudioSidebar } from "./studio-sidebar";
import { ProductContextForm } from "./product-context-form";
import { ContentWizard } from "./content-wizard";
import { useProductContext } from "./use-product-context";

export function Dashboard() {
  const [tab, setTab] = useState("create");
  const { context, loaded, storageError, saveContext } = useProductContext();
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
        <StudioSidebar activeTab={tab} />
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
                <div className={"mb-8"}>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    새 콘텐츠 만들기
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    만들 콘텐츠의 유형과 제작 방식을 선택하고, 참고 자료와
                    원하는 조건을 입력하세요.
                  </p>
                </div>
                <ContentWizard
                  context={context}
                  onRegisterContext={() => setTab("products")}
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
        </main>
      </SidebarProvider>
    </Tabs>
  );
}
