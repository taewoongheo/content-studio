import type { AssistantTarget } from "../model";
export async function assistantRequest<T>(target: AssistantTarget, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/editor-assistant${body ? "" : `?${new URLSearchParams(target)}`}`, {
    method: body ? "POST" : "GET", cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ ...target, ...body }) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "AI 요청에 실패했습니다.");
  return data;
}
