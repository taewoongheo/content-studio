import type { StoredAsset } from "@/lib/local-db/assets";
import type { StoredCharacter } from "@/lib/local-db/characters";
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

export async function listLibrary() {
  const response = await fetch("/api/library", { cache: "no-store" });
  return readJson<{ characters: StoredCharacter[]; assets: StoredAsset[] }>(response);
}

export function createCharacter(input: { description: string; file: File }) {
  const form = new FormData();
  form.set("description", input.description);
  form.set("image", input.file);
  return fetch("/api/library/characters", {
    method: "POST", body: form,
  }).then((response) => readJson<StoredCharacter>(response));
}

export function deleteCharacter(id: string) {
  return remove(`/api/library/characters/${encodeURIComponent(id)}`);
}

export function uploadAsset(input: {
  file: File; name: string; description: string;
}) {
  const form = new FormData();
  form.set("image", input.file);
  form.set("name", input.name);
  form.set("description", input.description);
  return fetch("/api/library/assets", { method: "POST", body: form })
    .then((response) => readJson<StoredAsset>(response));
}

export function deleteAsset(id: string) {
  return remove(`/api/library/assets/${encodeURIComponent(id)}`);
}
