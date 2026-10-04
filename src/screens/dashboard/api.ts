import type { PublishedPost } from "@/lib/local-db/published-posts";

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(body?.error ?? "요청을 처리하지 못했습니다.");
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

async function remove(url: string) {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw await responseError(response);
}

export async function listPublishedPosts() {
  const response = await fetch("/api/published-content", { cache: "no-store" });
  return readJson<PublishedPost[]>(response);
}

export function deletePublishedPost(id: string) {
  return remove(`/api/published-content/${encodeURIComponent(id)}`);
}
