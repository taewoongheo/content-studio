import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { AssetStore } from "@/lib/local-db/assets";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { ContentJobRegistry } from "../../workflow/registry";
import { EditorService } from "../../editor/service";
import { saveContentProject, loadContentProject } from "../service";
import { closeProjectTab } from "./close";
import { deleteProject, hasUnsavedChanges, renameProject } from "./management";

function fixture() {
  const database = openLocalDatabase(":memory:");
  const registry = new ContentJobRegistry();
  const stores = { projects: new ContentProjectStore(database), assets: new AssetStore(database) };
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
  const editor = new EditorService(registry);
  return { database, registry, stores, job, editor };
}

test("untouched temporary tabs close without saving; edited drafts prompt and can be discarded", () => {
  const f = fixture();
  try {
    assert.equal(hasUnsavedChanges(f.registry.getRecord(f.job.id), f.stores), false);
    assert.deepEqual(closeProjectTab(f.registry, f.job.id, f.job.tabId, 0, f.database, f.stores), { requiresConfirmation: false });
    assert.equal(f.stores.projects.list().length, 0);
    const next = f.registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
    f.editor.applyCommands(next.id, [{ type: "rename_slide", slideId: "slide-1", name: "Draft" }], 0);
    assert.deepEqual(closeProjectTab(f.registry, next.id, next.tabId, 1, f.database, f.stores), { requiresConfirmation: true });
    assert.equal(f.registry.has(next.id), true);
    assert.equal(f.stores.projects.list().length, 0);
    closeProjectTab(f.registry, next.id, next.tabId, 1, f.database, f.stores, "discard");
    assert.equal(f.registry.has(next.id), false);
    assert.equal(f.stores.projects.list().length, 0);
  } finally { f.database.close(); }
});

test("close compares actual DB contents: reverted edits close cleanly, discard preserves the saved version", () => {
  const f = fixture();
  try {
    saveContentProject(f.registry, f.job.id, "Saved", f.stores);
    const original = f.stores.projects.getContent(f.job.id);
    f.editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Changed" }], 0);
    assert.equal(closeProjectTab(f.registry, f.job.id, f.job.tabId, 1, f.database, f.stores).requiresConfirmation, true);
    f.editor.undo(f.job.id, 1);
    assert.equal(hasUnsavedChanges(f.registry.getRecord(f.job.id), f.stores), false);
    // A clean close must not issue an UPDATE, even though its revision differs from savedRevision.
    f.database.exec("CREATE TRIGGER fail_save BEFORE UPDATE ON content_projects BEGIN SELECT RAISE(ABORT, 'unexpected save'); END;");
    assert.equal(closeProjectTab(f.registry, f.job.id, f.job.tabId, 2, f.database, f.stores).requiresConfirmation, false);
    const reopened = loadContentProject(f.registry, f.job.id, f.stores);
    f.editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Discard me" }], 0);
    closeProjectTab(f.registry, f.job.id, reopened.tabId, 1, f.database, f.stores, "discard");
    assert.deepEqual(f.stores.projects.getContent(f.job.id), original);
    assert.equal(loadContentProject(f.registry, f.job.id, f.stores).editor.document.slides[0].name, f.job.editor.document.slides[0].name);
  } finally { f.database.close(); }
});

test("renaming changes project metadata without saving draft contents or creating a temporary project", () => {
  const f = fixture();
  try {
    renameProject(f.registry, f.job.id, " Temporary ", f.job.tabId, f.database, f.stores);
    assert.equal(f.registry.get(f.job.id).name, "Temporary");
    assert.equal(f.stores.projects.list().length, 0);
    assert.equal(hasUnsavedChanges(f.registry.getRecord(f.job.id), f.stores), true);
    saveContentProject(f.registry, f.job.id, "Temporary", f.stores);
    const document = f.stores.projects.getContent(f.job.id)!.document;
    f.editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Not saved" }], 1);
    renameProject(f.registry, f.job.id, "Renamed", f.job.tabId, f.database, f.stores);
    assert.equal(f.stores.projects.getSummary(f.job.id)?.name, "Renamed");
    assert.deepEqual(f.stores.projects.getContent(f.job.id)!.document, document);
    assert.equal(hasUnsavedChanges(f.registry.getRecord(f.job.id), f.stores), true);
    const before = f.registry.get(f.job.id);
    assert.throws(() => renameProject(f.registry, f.job.id, " ", f.job.tabId, f.database, f.stores), /이름/);
    assert.deepEqual(f.registry.get(f.job.id), before);
  } finally { f.database.close(); }
});

test("clean saved rename stays clean and broadcasts one tab update", () => {
  const f = fixture();
  try {
    saveContentProject(f.registry, f.job.id, "Old", f.stores);
    let changes = 0;
    f.registry.subscribeTabs(() => changes++);
    renameProject(f.registry, f.job.id, "New", f.job.tabId, f.database, f.stores);
    assert.equal(changes, 1);
    assert.equal(f.registry.get(f.job.id).savedRevision, f.registry.get(f.job.id).editor.revision);
    assert.equal(hasUnsavedChanges(f.registry.getRecord(f.job.id), f.stores), false);
  } finally { f.database.close(); }
});

test("delete removes the saved project and tab; DB failure rolls back the tab without a close event", () => {
  const f = fixture();
  try {
    saveContentProject(f.registry, f.job.id, "Delete", f.stores);
    let closed = 0;
    f.registry.subscribe(f.job.id, () => {}, () => closed++);
    f.database.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON content_projects BEGIN SELECT RAISE(ABORT, 'delete failed'); END;");
    const before = f.registry.get(f.job.id);
    assert.throws(() => deleteProject(f.registry, f.job.id, f.job.tabId, f.database, f.stores), /delete failed/);
    assert.deepEqual(f.registry.get(f.job.id), before);
    assert.equal(closed, 0);
    f.database.exec("DROP TRIGGER fail_delete");
    deleteProject(f.registry, f.job.id, f.job.tabId, f.database, f.stores);
    assert.equal(closed, 1);
    assert.equal(f.registry.has(f.job.id), false);
    assert.equal(f.stores.projects.getSummary(f.job.id), null);
    assert.throws(() => loadContentProject(f.registry, f.job.id, f.stores), /찾을/);
  } finally { f.database.close(); }
});


test("project deletion cascades embedded assets while preserving the shared image library", () => {
  const f = fixture();
  try {
    const bytes = Buffer.from("shared-image");
    const asset = f.stores.assets.create({ name: "Shared", type: "image/png", bytes });
    f.stores.projects.save({ id: f.job.id, name: "With asset", aspectRatio: "4:5", slideCount: 2,
      outputLanguage: "English", document: f.job.editor.document,
      assets: [{ assetId: asset.id, name: asset.name, description: "", type: "image/png", bytes }] });
    deleteProject(f.registry, f.job.id, f.job.tabId, f.database, f.stores);
    assert.deepEqual(f.database.prepare("SELECT * FROM content_project_assets").all(), []);
    assert.deepEqual(f.stores.assets.readImage(asset.id)?.bytes, bytes);
  } finally { f.database.close(); }
});

test("a document changed after confirmation cannot be silently saved or discarded by a stale decision", () => {
  const f = fixture();
  try {
    f.editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "First" }], 0);
    assert.equal(closeProjectTab(f.registry, f.job.id, f.job.tabId, 1, f.database, f.stores).requiresConfirmation, true);
    f.editor.applyCommands(f.job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Second" }], 1);
    for (const decision of ["save", "discard"] as const) {
      assert.throws(() => closeProjectTab(f.registry, f.job.id, f.job.tabId, 1, f.database, f.stores, decision), /변경/);
      assert.equal(f.registry.get(f.job.id).editor.document.slides[0].name, "Second");
      assert.equal(f.stores.projects.getSummary(f.job.id), null);
    }
  } finally { f.database.close(); }
});
