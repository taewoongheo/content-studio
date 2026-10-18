import { syncOpenProjectName } from "../projects/lifecycle/management";
import type { ContentJobRegistry } from "../workflow/registry";
import type { TemplateSettingsInput } from "../projects/composition";
import { randomUUID } from "node:crypto";
import type { ContentProjectStore } from "../server/persistence/projects/store";
import { ContentTemplateStore } from "../server/persistence/templates/store";
import { TemplateError, templateCreateSchema, type TemplateCreateInput } from "../projects/composition";
import type { EditorDocument } from "../editor/types";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";

/** Copy a saved selection, including content and used assets. Never retain a source-project relationship. */
export function createTemplateFromProject(projects: ContentProjectStore, projectId: string, raw: TemplateCreateInput) {
  const input = templateCreateSchema.parse(raw);
  return projects.database.transaction(() => {
    const source = projects.get(projectId);
    if (!source) throw new TemplateError("PROJECT_NOT_FOUND");
    const original = source.document as EditorDocument;
    const selected = new Set(input.slideIds);
    if (selected.size !== input.slideIds.length || input.slideIds.some(id => !original.slides.some(slide => slide.id === id)))
      throw new TemplateError("INVALID_METADATA", "원본에 있는 페이지를 중복 없이 선택해 주세요.");
    const document = structuredClone(original);
    document.slides = document.slides.filter(slide => selected.has(slide.id));
    const used = new Set(document.slides.flatMap(slide => slide.placements.map(p => p.elementId)));
    document.elements = document.elements.filter(element => used.has(element.id));
    // A selection may omit hook/CTA. Sequential documents support arbitrary representative-page selections.
    document.structure = "sequential";
    const images = new Set(document.elements.filter(e => e.kind === "image").map(e => e.id));
    const assetIds = new Set(document.slides.flatMap(slide => slide.placements.filter(p => images.has(p.elementId) && p.value).map(p => p.value)));
    const template = new ContentTemplateStore(projects.database).create({ id: randomUUID(), name: input.templateName,
      topic: input.templateTopic, message: input.templateMessage, composition: input.composition,
      document, outputLanguage: source.outputLanguage, assets: source.assets.filter(asset => assetIds.has(asset.assetId)) });
    notifyProjectsChanged();
    return template;
  })();
}

export function updateTemplateSettings(registry: ContentJobRegistry, projects: ContentProjectStore, templateId: string, input: TemplateSettingsInput) {
  return registry.transaction(() => projects.database.transaction(() => {
    const template = new ContentTemplateStore(projects.database).update(templateId, input);
    if (template) syncOpenProjectName(registry, templateId, template.name, { projects });
    registry.afterCommit(notifyProjectsChanged);
    return template;
  })());
}
