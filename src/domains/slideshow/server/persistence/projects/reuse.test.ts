import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "./store";
import { ContentTemplateStore } from "../templates/store";
import { createTemplateFromProject } from "../../../templates/service";
import { ContentJobRegistry } from "../../../workflow/registry";
import { createContentProject, saveContentProject, loadContentProject } from "../../../projects/service";
import { SlideshowProjectWrites } from "../../project-writes";

export const templateSettings = { templateName: "Template", templateTopic: "Exercise guide", templateMessage: "Compare options", composition: "An image and short explanation per page" };

test("template selection copies content independently, never records registration on the source", async () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db), registry = new ContentJobRegistry();
    const stores = { projects }, writes = new SlideshowProjectWrites(registry, db);
    const source = createContentProject(registry, { name: "Original" }, stores);
    saveContentProject(registry, source.id, "Original", stores);
    const before = projects.get(source.id);
    const template = createTemplateFromProject(projects, source.id, { ...templateSettings, slideIds: ["slide-2"] });
    assert.notEqual(template.id, source.id);
    assert.deepEqual(projects.get(source.id), before);
    assert.equal("isTemplate" in projects.getSummary(source.id)!, false);
    assert.equal(templates.read(template.id)?.document.slides.length, 1);
    const opened = loadContentProject(registry, template.id, stores);
    await writes.edit(template.id, [{ type: "rename_slide", slideId: "slide-2", name: "Template body" }], opened.editor.revision);
    assert.deepEqual(projects.get(source.id), before);
    const clone = writes.clone({ templateId: template.id });
    assert.equal(clone.editor.document.slides[0].name, "Template body");
    assert.equal(projects.getSummary(clone.id)?.sourceTemplateId, template.id);
    projects.delete(source.id);
    assert.ok(templates.get(template.id));
    templates.delete(template.id);
    assert.ok(projects.get(clone.id));
    assert.equal(projects.getSummary(clone.id)?.sourceTemplateId, null);
  } finally { db.close(); }
});

test("selection rejects empty, duplicate and unknown pages without partial templates", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), registry = new ContentJobRegistry();
    const source = createContentProject(registry, {}, { projects }); saveContentProject(registry, source.id, "Original", { projects });
    for (const slideIds of [[], ["missing"], ["slide-1", "slide-1"]])
      assert.throws(() => createTemplateFromProject(projects, source.id, { ...templateSettings, slideIds }));
    assert.equal(projects.listTemplates().length, 0);
  } finally { db.close(); }
});
