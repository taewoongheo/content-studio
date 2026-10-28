import test from "node:test";
import assert from "node:assert/strict";
import { ContentJobRegistry } from "../workflow/registry";
import { EditorService } from "./service";
test("AI command edits share one undo entry without absorbing manual edits or undo", () => {
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English" });
  const editor = new EditorService(registry);
  const initial = structuredClone(job.editor.document);
  const apply = (color: string, group?: string) => editor.applyCommands(job.id,
    [{ type: "set_slide_background", slideId: job.editor.document.slides[0].id, color }], registry.get(job.id).editor.revision, [], group);
  apply("#123456", "command-a"); apply("#654321", "command-a");
  assert.equal(registry.getRecord(job.id).editorHistory.length, 1);
  editor.undo(job.id, 2); assert.deepEqual(registry.get(job.id).editor.document, initial);
  apply("#222222", "command-a"); apply("#333333"); apply("#444444", "command-a");
  assert.equal(registry.getRecord(job.id).editorHistory.length, 3);
  editor.undo(job.id, registry.get(job.id).editor.revision);
  assert.equal(registry.get(job.id).editor.document.slides[0].backgroundColor, "#333333");
});
