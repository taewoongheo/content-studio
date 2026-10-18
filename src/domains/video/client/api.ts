import type { VideoDocument, VideoSnapshot, VideoSummary } from "@/domains/video/domain/model";
export async function videoRequest<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (response.status === 204) return undefined as T;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "영상 요청에 실패했습니다.");
  return data as T;
}
export const videoEndpoint = (id: string) => `/api/video-projects/${encodeURIComponent(id)}`;
export const listVideoProjects = () => videoRequest<VideoSummary[]>("/api/video-projects");
export const openVideoProject = (id: string) => videoRequest<VideoSnapshot>(videoEndpoint(id));
export const createVideoProject = () => videoRequest<VideoSnapshot>("/api/video-projects", "POST");
export const saveVideoProject = (s: VideoSnapshot, document: VideoDocument) => videoRequest<VideoSnapshot>(videoEndpoint(s.id), "PUT", { document, expectedTabId: s.tabId, expectedRevision: s.revision });
export const videoAction = (s: VideoSnapshot, action: "undo" | "redo" | "clone") => videoRequest<VideoSnapshot>(videoEndpoint(s.id), "POST", { action, expectedTabId: s.tabId, expectedRevision: s.revision });
export const deleteVideoProject = (project: { id: string; revision: number; tabId?: string | null }) => videoRequest<void>(videoEndpoint(project.id), "DELETE", { expectedTabId: project.tabId, expectedRevision: project.revision });
export async function renderVideoProject(snapshot: VideoSnapshot): Promise<Blob> {
  const response = await fetch(`${videoEndpoint(snapshot.id)}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedTabId: snapshot.tabId, expectedRevision: snapshot.revision }),
  });
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error ?? "내보내기에 실패했습니다.");
  }
  return response.blob();
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
