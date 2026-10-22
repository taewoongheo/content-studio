import type { Row, WorkDetail, WorkItem } from "./domain/contracts";
export interface ProductionSnapshot {
  tasks: WorkItem[];
  logs: Row[];
  references: Row[];
  visuals: Row[];
  sync: { running: boolean };
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
export async function productionAction(action: Record<string, unknown>) {
  const response = await fetch("/api/content-production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
export const fetchWork = (id: string) =>
  fetchProduction<WorkDetail>(`?id=${encodeURIComponent(id)}`);
