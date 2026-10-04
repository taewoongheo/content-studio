import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { EditorService } from "@/lib/content-jobs/editor/service";
import { makeElementDefinition } from "@/lib/content-jobs/editor/elements/factory";
import { createContentProject, saveContentProject } from "@/lib/content-jobs/projects/service";
import { editWithLocalImages } from "../tools/images";
import { editSchema } from "../tools/schema";

function fixture() {
  const database = openLocalDatabase(":memory:");
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 3, outputLanguage: "English" });
  return { database, registry, job, stores: { projects: new ContentProjectStore(database) } };
}

test("MCP uses the full existing command schema and rejects unknown properties", () => {
  assert.equal(editSchema.safeParse({ projectId: "p", expectedTabId: "t", expectedRevision: 0, commands: [
    { type: "update_visual", scope: "common", elementId: "title", style: { color: "#FF0000" } },
    { type: "set_local_image", slideId: "s", placementId: "image", localPath: "/tmp/image.png" },
  ] }).success, true);
  assert.equal(editSchema.safeParse({ projectId: "p", expectedTabId: "t", expectedRevision: 0, commands: [
    { type: "update_visual", scope: "common", elementId: "title", style: { invented: true } },
  ] }).success, false);
});

test("local images, shapes and styles apply as one undo step; invalid batches leave no assets", async () => {
  const f = fixture();
  const directory = await mkdtemp(join(tmpdir(), "studio-mcp-image-"));
  try {
    const localPath = join(directory, "image.png");
    await writeFile(localPath, await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer());
    const image = makeElementDefinition({ id: "image", kind: "image" });
    const before = f.registry.get(f.job.id);
    const commands = [
      { type: "add_element" as const, element: image },
      { type: "place_element" as const, slideId: "slide-1", elementId: "image", placementId: "photo" },
      { type: "set_local_image" as const, slideId: "slide-1", placementId: "photo", localPath },
    ];
    await assert.rejects(editWithLocalImages(f.registry, f.database, f.job.id, [...commands,
      { type: "remove_slide", slideId: "missing" }], 0), /commands\[3\]/);
    assert.deepEqual(f.registry.get(f.job.id), before);
    assert.equal(Object.keys(f.registry.getRecord(f.job.id).imageData).length, 0);
    const updated = await editWithLocalImages(f.registry, f.database, f.job.id, commands, 0);
    assert.equal(updated.editor.revision, 1);
    assert.equal(f.registry.getRecord(f.job.id).editorHistory.length, 1);
    assert.equal(updated.assets.length, 1);
    assert.equal(updated.editor.document.slides[0].placements.find((p) => p.id === "photo")?.value, updated.assets[0].id);
    const undone = new EditorService(f.registry).undo(f.job.id, 1);
    assert.deepEqual(undone.editor.document, before.editor.document);
    assert.equal(undone.assets.length, 1);
    await assert.rejects(editWithLocalImages(f.registry, f.database, f.job.id, commands, 0), /변경되었습니다/);
    assert.equal(Object.keys(f.registry.getRecord(f.job.id).imageData).length, 1);
  } finally { f.database.close(); await rm(directory, { recursive: true, force: true }); }
});

test("clone uses current draft, leaves original untouched and starts independent history", async () => {
  const f = fixture();
  try {
    await saveContentProject(f.registry, f.job.id, "Back routine", f.stores);
    const editor = new EditorService(f.registry);
    editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Unsaved title" }], 0);
    const before = f.registry.get(f.job.id);
    const clone = await createContentProject(f.registry, { sourceProjectId: f.job.id, name: "Chest routine" }, f.stores);
    assert.notEqual(clone.id, before.id);
    assert.equal(clone.name, "Chest routine");
    assert.deepEqual(clone.editor.document, before.editor.document);
    assert.equal(clone.editor.revision, 0);
    editor.applyCommands(clone.id, [{ type: "rename_slide", slideId: "slide-1", name: "Changed clone" }], 0);
    assert.deepEqual(f.registry.get(f.job.id), before);
    assert.equal(f.stores.projects.list().length, 1);
    const freshRegistry = new ContentJobRegistry();
    const savedClone = await createContentProject(freshRegistry, { sourceProjectId: f.job.id }, f.stores);
    assert.equal(savedClone.editor.document.slides[0].name, undefined);
    const blank = await createContentProject(f.registry, {}, f.stores);
    assert.equal(blank.slideCount, 6);
    const draftClone = await createContentProject(f.registry, { sourceProjectId: blank.id }, f.stores);
    assert.notEqual(draftClone.id, blank.id);
    assert.deepEqual(draftClone.editor.document, blank.editor.document);
    const count = f.registry.list().length;
    assert.throws(() => createContentProject(f.registry, { sourceProjectId: "missing" }, f.stores));
    assert.equal(f.registry.list().length, count);
  } finally { f.database.close(); }
});

test("shared styles clear only changed local overrides and notify the open editor", async () => {
  const f = fixture();
  try {
    const editor = new EditorService(f.registry);
    const text = makeElementDefinition({ id: "title", kind: "text" });
    editor.applyCommands(f.job.id, [
      { type: "add_element", element: text },
      { type: "place_element", slideId: "slide-1", elementId: "title", placementId: "title-1" },
      { type: "place_element", slideId: "slide-2", elementId: "title", placementId: "title-2" },
      { type: "update_visual", scope: "local", slideId: "slide-1", placementId: "title-1", style: { color: "#00FF00", fontSize: 60 } },
    ], 0);
    let observed = -1;
    const unsubscribe = f.registry.subscribe(f.job.id, (job) => { observed = job.editor.revision; });
    const next = await editWithLocalImages(f.registry, f.database, f.job.id, [
      { type: "update_visual", scope: "common", elementId: "title", style: { color: "#FF0000" } },
    ], 1);
    assert.equal(observed, 2);
    assert.equal(next.editor.document.elements.find((e) => e.id === "title")?.style.color, "#FF0000");
    assert.deepEqual(next.editor.document.slides[0].placements.find((p) => p.id === "title-1")?.styleOverride, { fontSize: 60 });
    unsubscribe();
  } finally { f.database.close(); }
});
