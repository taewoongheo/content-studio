import { readJson } from "./http";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";

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

export async function updateProjectMetadata(id: string, input: { topic: string; message: string; templateId?: string | null }) {
  const response = await fetch(`/api/content-projects/${encodeURIComponent(id)}/metadata`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  return readJson<SavedProjectSummary>(response);
}

export async function publishProject(id: string) {
  return readJson<SavedProjectSummary>(await fetch(`/api/content-projects/${encodeURIComponent(id)}/publication`, { method: "POST" }));
}

export async function readSavedDocument(projectId: string) {
  return readJson<import("../editor/types").EditorDocument>(await fetch(`/api/content-projects/${encodeURIComponent(projectId)}/preview`, { cache: "no-store" }));
}
