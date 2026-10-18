import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentTemplateStore } from "./store";
import { ContentProjectStore } from "../projects/store";
import { createBlankDocument } from "../../../editor/document";

function seed(templates: ContentTemplateStore, id: string) {
  return templates.create({ id, name: id, topic: "Guide", message: "Compare", composition: "Short list", outputLanguage: "English", assets: [],
    document: createBlankDocument({ structure: "sequential", slideCount: 2, aspectRatio: "4:5" }) });
}
test("templates retain creation order when metadata changes or another template is deleted", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const templates = new ContentTemplateStore(db);
    for (const id of ["a", "b", "c"]) seed(templates, id);
    const untouched = templates.get("b");
    templates.update("a", { templateName: "Updated", composition: "Two columns" });
    assert.deepEqual(templates.list().map(t => t.id), ["a", "b", "c"]);
    assert.equal(templates.get("a")?.composition, "Two columns");
    templates.delete("a");
    assert.deepEqual(templates.list().map(t => t.id), ["b", "c"]);
    assert.deepEqual(templates.get("b"), untouched);
  } finally { db.close(); }
});
test("template deletion failure rolls back assets and project links", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const templates = new ContentTemplateStore(db), projects = new ContentProjectStore(db);
    seed(templates, "a"); seed(templates, "b");
    projects.save({ id: "child", name: "Child", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
    projects.updateMetadata("child", { topic: "Topic", message: "Message", templateId: "a" }); projects.publish("child");
    const before = projects.get("child"), beforeTemplates = templates.list();
    db.exec("CREATE TRIGGER fail_removal BEFORE DELETE ON content_templates BEGIN SELECT RAISE(ABORT, 'removal failure'); END;");
    assert.throws(() => templates.delete("a"), /removal failure/);
    assert.deepEqual(projects.get("child"), before); assert.deepEqual(templates.list(), beforeTemplates);
    db.exec("DROP TRIGGER fail_removal"); templates.delete("a");
    assert.equal(projects.getSummary("child")?.sourceTemplateId, null);
    assert.equal(projects.getSummary("child")?.publishedAt, before?.publishedAt);
  } finally { db.close(); }
});
