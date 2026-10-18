import { readJson } from "./http";
import type { SavedTemplateSummary } from "../domain/projects";
import type { TemplateSettingsInput } from "../templates/metadata";

export async function updateTemplateSettings(id: string, input: TemplateSettingsInput) {
  const response = await fetch(`/api/content-templates/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  return readJson<SavedTemplateSummary>(response);
}

export function listContentTemplates() {
  return fetch("/api/content-templates", { cache: "no-store" }).then(response => readJson<SavedTemplateSummary[]>(response));
}
export async function deleteTemplate(id: string) {
  const response = await fetch(`/api/content-templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await readJson(response);
}

export async function createTemplate(projectId: string, input: import("../templates/metadata").TemplateCreateInput) {
  return readJson<SavedTemplateSummary>(await fetch("/api/content-templates", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, ...input }),
  }));
}
