import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";
export async function closeTab(tab: OpenProjectTab, decision: "check" | "save" | "discard" = "check") {
  const response = await fetch(`/api/content-jobs/${encodeURIComponent(tab.projectId)}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedTabId: tab.tabId, expectedRevision: tab.revision, decision }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "탭을 닫지 못했습니다.");
  }
  return response.status !== 204;
}
