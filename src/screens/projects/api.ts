import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { SavedProjectSummary } from "@/lib/local-db/projects/store";

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? "프로젝트 요청을 처리하지 못했습니다.");
  return body as T;
}

export function listContentProjects() {
  return fetch("/api/content-projects", { cache: "no-store" })
    .then((response) => readJson<SavedProjectSummary[]>(response));
}

export function saveContentProject(jobId: string, name: string, tabId?: string) {
  return fetch("/api/content-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, name, expectedTabId: tabId }),
  }).then((response) => readJson<SavedProjectSummary>(response));
}

export function loadContentProject(projectId: string) {
  return fetch(`/api/content-projects/${encodeURIComponent(projectId)}`, {
    method: "POST",
  })
    .then((response) => readJson<ContentJobSnapshot>(response));
}
