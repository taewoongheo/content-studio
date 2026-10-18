import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "../server/persistence/projects/store";
import { ContentTemplateStore } from "../server/persistence/templates/store";
import { ContentJobRegistry } from "../workflow/registry";
import { createContentProject, loadContentProject, saveContentProject } from "../projects/service";
import { createTemplateFromProject, updateTemplateSettings } from "./service";
import { makeElementDefinition } from "../editor/elements/factory";
import { EditorService } from "../editor/service";
import { createEditorImage } from "../editor/assets";
import { SlideshowProjectWrites } from "../server/project-writes";

const settings = { templateName: "Template", templateTopic: "Guide", templateMessage: "Compare", composition: "Images per page" };
test("selected pages preserve Element sharing and independently own only their used assets", async () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db), registry = new ContentJobRegistry();
    const source = createContentProject(registry, {}, { projects });
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const selected = createEditorImage({ name: "selected.png", type: "image/png", bytes });
    const omitted = createEditorImage({ name: "omitted.png", type: "image/png", bytes });
    new EditorService(registry).applyCommands(source.id, [
      { type: "add_element", element: makeElementDefinition({ id: "photo", kind: "image" }) },
      ...["slide-1", "slide-2", "slide-3"].flatMap(slideId => [
        { type: "place_element", slideId, elementId: "photo", placementId: "p" },
        { type: "set_slot_value", slideId, placementId: "p", value: slideId === "slide-1" ? omitted.id : selected.id },
      ]),
      { type: "update_visual", scope: "local", slideId: "slide-3", placementId: "p", style: { rotation: 12 } },
    ], 0, [selected, omitted]);
    saveContentProject(registry, source.id, "Source", { projects });
    const template = createTemplateFromProject(projects, source.id, { ...settings, slideIds: ["slide-2", "slide-3"] });
    const content = templates.read(template.id)!;
    assert.deepEqual(content.assets.map(asset => asset.assetId), [selected.id]);
    const first = content.document.slides[0].placements.find(p => p.id === "p")!;
    const second = content.document.slides[1].placements.find(p => p.id === "p")!;
    assert.equal(first.elementId, second.elementId); assert.equal(second.styleOverride?.rotation, 12);
    projects.delete(source.id);
    assert.deepEqual(templates.getAsset(template.id, selected.id)?.bytes, Buffer.from(bytes));
    const opened = loadContentProject(registry, template.id, { projects });
    db.exec("CREATE TRIGGER no_rewrite BEFORE UPDATE ON content_template_assets BEGIN SELECT RAISE(ABORT, 'asset rewritten'); END;");
    await new SlideshowProjectWrites(registry, db).edit(template.id, [{ type: "rename_slide", slideId: "slide-2", name: "Body" }], opened.editor.revision);
    const clone = new SlideshowProjectWrites(registry, db).clone({ templateId: template.id });
    assert.equal(projects.get(clone.id)?.assets.length, 1);
    assert.deepEqual(projects.get(clone.id)?.assets[0].bytes, Buffer.from(bytes));
  } finally { db.close(); }
});
test("settings rename updates an open template without saving its unsaved document", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db), registry = new ContentJobRegistry();
    const source = createContentProject(registry, {}, { projects }); saveContentProject(registry, source.id, "Source", { projects });
    const template = createTemplateFromProject(projects, source.id, { ...settings, slideIds: ["slide-2"] });
    loadContentProject(registry, template.id, { projects });
    new EditorService(registry).applyCommands(template.id, [{ type: "rename_slide", slideId: "slide-2", name: "Unsaved" }], 0);
    updateTemplateSettings(registry, projects, template.id, { templateName: "New name" });
    assert.equal(registry.get(template.id).name, "New name");
    assert.equal(templates.get(template.id)?.name, "New name");
    assert.notEqual(templates.getContent(template.id)?.document.slides[0].name, "Unsaved");
    saveContentProject(registry, template.id, registry.get(template.id).name!, { projects });
    assert.equal(templates.get(template.id)?.name, "New name");
    assert.equal(templates.getContent(template.id)?.document.slides[0].name, "Unsaved");
  } finally { db.close(); }
});
