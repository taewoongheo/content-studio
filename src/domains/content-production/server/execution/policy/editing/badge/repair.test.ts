import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { badgeElementIds, badgeRepairCommands } from "./repair";

test("canonical repair replaces legacy badges, clears overrides, preserves content and saves one undoable batch", async () => {
  const db = openLocalDatabase(":memory:");
  const registry = new ContentJobRegistry();
  const writes = new SlideshowProjectWrites(registry, db);
  try {
    const project = writes.create({ name: "Badge repair", topic: "Chest", message: "Exercises", content_type: "List", slideCount: 3 });
    const first = project.editor.document.slides[0].id;
    const legacy = makeElementDefinition({ id: "legacy", kind: "text" });
    legacy.style.backgroundColor = "#000000";
    const before = await writes.edit(project.id, [
      { type: "add_element", element: legacy },
      { type: "place_element", slideId: first, elementId: legacy.id, placementId: "old" },
      { type: "set_slot_value", slideId: first, placementId: "old", value: "LIFTCODE", textColors: [{ start: 0, end: 8, color: "#FF0000" }] },
      { type: "update_visual", scope: "local", slideId: first, placementId: "old", frame: { ...legacy.frame, y: 0.99 }, style: { fontSize: 45 } },
      { type: "add_element", element: makeElementDefinition({ id: "body", kind: "text" }) },
      { type: "place_element", slideId: first, elementId: "body", placementId: "body-placement" },
      { type: "set_slot_value", slideId: first, placementId: "body-placement", value: "Keep this copy" },
    ], project.editor.revision, project.tabId);
    const commands = badgeRepairCommands(before.editor.document);
    await assert.rejects(writes.edit(project.id, commands, 0, project.tabId));
    await assert.rejects(async () => writes.edit(project.id, commands, before.editor.revision, "wrong-tab"));
    const repaired = await writes.edit(project.id, commands, before.editor.revision, project.tabId);
    const doc = repaired.editor.document;
    assert.equal(repaired.savedRevision, repaired.editor.revision);
    assert.deepEqual(new ContentProjectStore(db).get(project.id)?.document, doc);
    assert.equal(doc.elements.some(e => e.id === "legacy"), false);
    const ids = badgeElementIds(doc);
    assert.equal(ids.size, 2);
    const background = doc.elements.find(e => ids.has(e.id) && e.kind === "rectangle")!;
    const label = doc.elements.find(e => ids.has(e.id) && e.kind === "text")!;
    assert.deepEqual(background.frame, { x: 0.04, y: 0.9144, width: 0.1783550709144038, height: 0.04564114259649923 });
    assert.deepEqual(label.frame, { x: 0.0591, y: 0.9179999999999999, width: 0.14557052241465326, height: 0.03899880266833913 });
    assert.equal(background.style.backgroundColor, "#000000");
    assert.equal(background.style.borderRadius, 99);
    assert.equal(label.style.fontSize, 25);
    assert.equal(label.style.color, "#FFFFFF");
    for (const slide of doc.slides) {
      const pair = slide.placements.slice(-2);
      assert.deepEqual(pair.map(p => p.elementId), [background.id, label.id]);
      assert.equal(pair[1].value, "LIFTCODE");
      for (const p of pair) {
        assert.equal(p.frameOverride, null);
        assert.equal(p.styleOverride, null);
        assert.ok(!p.textColors?.length && !p.textWeights?.length);
      }
      const original = before.editor.document.slides.find(s => s.id === slide.id)!;
      assert.deepEqual(slide.placements.slice(0, -2), original.placements.filter(p => p.elementId !== "legacy"));
    }
    const undone = writes.undo(project.id, repaired.editor.revision, project.tabId);
    assert.deepEqual(undone.editor.document, before.editor.document);
  } finally { db.close(); }
});
