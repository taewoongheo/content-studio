import type { PerformanceRefresh } from "./domain/performance";
import type { ProductionStep, Row, WorkDetail, WorkItem } from "./domain/contracts";
export interface ProductionSnapshot {
  tasks: WorkItem[];
  logs: Row[];
  planningLogs: Row[];
  externalReferences: Row[];
  referenceAccounts: Row[];
  visuals: Row[];
  sync: { running: boolean; report: PerformanceRefresh | null };
  settings: { model: string };
  configured: { apify: boolean };
}
export async function fetchProduction<T>(params = ""): Promise<T> {
  const response = await fetch(`/api/content-production${params}`, {
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export async function productionAction(action: Record<string, unknown>, signal?: AbortSignal) {
  const response = await fetch("/api/content-production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
    signal,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export const fetchWork = (id: string) =>
  fetchProduction<WorkDetail>(`?id=${encodeURIComponent(id)}`);

export async function requestDisplayTranslation(id: string, step: ProductionStep, sourceKey: string, signal?: AbortSignal): Promise<Row> {
  const response = await productionAction({ action: "translate_display", id, step }, signal) as { source: Row; translated: Row };
  if (JSON.stringify(response.source) !== sourceKey)
    throw new Error("내용이 갱신되었습니다. 다시 번역해 주세요.");
  return response.translated;
}

export type CanvasTranslationRequest = { id: string; step: ProductionStep; source: string };
export async function requestCanvasTranslation(items: CanvasTranslationRequest[], signal: AbortSignal) {
  const response = await productionAction({ action: "translate_canvas", items: items.map(({ id, step }) => ({ id, step })) }, signal) as { source: Row; translated: Row };
  return Object.fromEntries(items.map(item => {
    const key = `${item.id}:${item.step}`;
    if (JSON.stringify(response.source[key]) !== item.source)
      throw new Error("내용이 갱신되었습니다. 다시 번역해 주세요.");
    return [key, { source: item.source, value: response.translated[key] as Row }];
  }));
}
