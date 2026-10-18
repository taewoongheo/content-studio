export async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? "프로젝트 요청을 처리하지 못했습니다.");
  return body as T;
}
