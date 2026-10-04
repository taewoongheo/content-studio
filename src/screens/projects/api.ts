import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { ProjectReuseUpdate } from "@/lib/content-jobs/projects/reuse-guide";
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

export function saveContentProject(jobId: string, name: string, tabId?: string, onlyIfChanged = false) {
  return fetch("/api/content-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, name, expectedTabId: tabId, onlyIfChanged }),
  }).then((response) => readJson<SavedProjectSummary | null>(response));
}

export function loadContentProject(projectId: string) {
  return fetch(`/api/content-projects/${encodeURIComponent(projectId)}`, {
    method: "POST",
  })
    .then((response) => readJson<ContentJobSnapshot>(response));
}

async function projectMutation(id: string, method: "PATCH" | "DELETE", body: Record<string, unknown>) {
  const response = await fetch(`/api/content-projects/${encodeURIComponent(id)}`, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error ?? "프로젝트를 변경하지 못했습니다.");
  }
}
export function renameProject(id: string, name: string, expectedTabId?: string) {
  return projectMutation(id, "PATCH", { name, expectedTabId });
}
export function deleteProject(id: string, expectedTabId?: string) {
  return projectMutation(id, "DELETE", { expectedTabId });
}

export async function updateProjectReuse(id: string, input: ProjectReuseUpdate) {
  const response = await fetch(`/api/content-projects/${encodeURIComponent(id)}/reuse`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  return readJson<SavedProjectSummary>(response);
}
