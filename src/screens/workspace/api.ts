import { videoRequest, videoEndpoint } from "@/domains/video/client/api";
import type { OpenProjectTab } from "@/domains/workspace/model";
export type CloseDecision = "save" | "discard";

export async function closeTab(tab: OpenProjectTab, decision: "check" | CloseDecision = "check"): Promise<{ requiresConfirmation: boolean }> {
  if (tab.projectType === "video") { await videoRequest(videoEndpoint(tab.projectId), "POST", { action: "close", expectedTabId: tab.tabId, expectedRevision: tab.revision }); return { requiresConfirmation: false }; }
  const response = await fetch(`/api/content-jobs/${encodeURIComponent(tab.projectId)}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedTabId: tab.tabId, expectedRevision: tab.revision, decision }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "탭을 닫지 못했습니다.");
  }
  if (response.status === 204) return { requiresConfirmation: false };
  return response.json();
}
