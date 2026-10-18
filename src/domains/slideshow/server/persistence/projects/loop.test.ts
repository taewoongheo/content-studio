import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "./store";
import { ContentTemplateStore } from "../templates/store";
import { createTemplateFromProject } from "../../../templates/service";
import { ContentJobRegistry } from "../../../workflow/registry";
import { createContentProject, saveContentProject } from "../../../projects/service";
import { SlideshowProjectWrites } from "../../project-writes";

test("independent templates follow reorder and publication; copying a source does not detach its parent", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db), registry = new ContentJobRegistry();
    const source = createContentProject(registry, {}, { projects }); saveContentProject(registry, source.id, "Source", { projects });
    const [a, b, c] = ["A", "B", "C"].map(name => createTemplateFromProject(projects, source.id, {
      templateName: name, templateTopic: "Guide", templateMessage: "Compare", composition: "Image with explanation", slideIds: ["slide-1", "slide-2"],
    }));
    templates.reorder([c.id, a.id, b.id], [a.id, b.id, c.id]);
    assert.equal(projects.contentPlan().nextTemplateId, c.id);
    const clone = new SlideshowProjectWrites(registry, db).clone({ templateId: c.id, topic: "Back", message: "Choose a supported row" });
    assert.equal(projects.contentPlan().nextTemplateId, c.id);
    projects.publish(clone.id);
    assert.equal(projects.contentPlan().nextTemplateId, a.id);
    projects.updateMetadata(source.id, { topic: "Original", message: "Message", templateId: b.id });
    const before = projects.get(source.id);
    createTemplateFromProject(projects, source.id, { templateName: "D", templateTopic: "Guide", templateMessage: "Compare", composition: "List", slideIds: ["slide-2"] });
    assert.deepEqual(projects.get(source.id), before);
    templates.delete(c.id);
    assert.equal(projects.getSummary(clone.id)?.sourceTemplateId, null);
    assert.ok(projects.getSummary(clone.id)?.publishedAt);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
