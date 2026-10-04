import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
async function readResponse(response: Response): Promise<ContentJobSnapshot> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "요청을 처리하지 못했습니다.");
  return body as ContentJobSnapshot;
}
export function createContentJob() {
  return fetch("/api/content-jobs", {
    method: "POST",
  }).then(readResponse);
}
export function postContentJobAction(jobId: string, body: Record<string, unknown>) {
  return fetch(`/api/content-jobs/${encodeURIComponent(jobId)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).then(readResponse);
}
export function getContentJob(jobId: string) {
  return fetch(`/api/content-jobs/${encodeURIComponent(jobId)}`, {
    headers: { Accept: "application/json" }, cache: "no-store",
  }).then(readResponse);
}
export function uploadEditorImage(jobId: string, image: File, tabId?: string) {
  const form = new FormData();
  form.set("image", image);
  return fetch(`/api/content-jobs/${encodeURIComponent(jobId)}/assets`, {
    method: "POST", headers: tabId ? { "x-tab-id": tabId } : {}, body: form,
  }).then(readResponse);
}
export function attachStoredEditorImage(jobId: string, assetId: string, tabId?: string) {
  return fetch(`/api/content-jobs/${encodeURIComponent(jobId)}/assets`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(tabId ? { "x-tab-id": tabId } : {}) }, body: JSON.stringify({ assetId }),
  }).then(readResponse);
}
