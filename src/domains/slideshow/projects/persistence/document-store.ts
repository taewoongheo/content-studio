import { ContentTemplateStore } from "../../server/persistence/templates/store";
import type { ContentProjectStore } from "../../server/persistence/projects/store";

/** Editor lifecycle shares one engine; ownership decides which repository persists the document. */
export function documentStore(stores: { projects: ContentProjectStore }, id: string) {
  const templates = new ContentTemplateStore(stores.projects.database);
  return templates.get(id) ? templates : stores.projects;
}
export function savedDocument(stores: { projects: ContentProjectStore }, id: string) {
  return stores.projects.get(id) ?? new ContentTemplateStore(stores.projects.database).read(id);
}
