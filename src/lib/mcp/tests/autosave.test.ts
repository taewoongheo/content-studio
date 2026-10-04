import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { createContentProject, saveContentProject, loadContentProject } from "@/lib/content-jobs/projects/service";
import { contentProjectEvents } from "@/lib/content-jobs/projects/events";
import { makeElementDefinition } from "@/lib/content-jobs/editor/elements/factory";
import { McpProjectWrites } from "../tools/project-writes";

function fixture() {
  const database = openLocalDatabase(":memory:");
  const registry = new ContentJobRegistry();
  const writes = new McpProjectWrites(registry, database);
  const stores = { projects: new ContentProjectStore(database) };
  function seed(name: string) {
    const job = createContentProject(registry, { name }, stores);
    saveContentProject(registry, job.id, name, stores);
    stores.projects.updateReuse(job.id, { composition: "도입 후 항목별 이미지와 짧은 설명을 반복한다.", isTemplate: true });
    return registry.get(job.id);
  }
  return { database, registry, writes, stores, seed };
}

test("부분 색상을 저장·복구하고 잘못된 구간은 저장본을 바꾸지 않는다", async () => {
  const f = fixture();
  try {
    const job = f.seed("Colors");
    const edited = await f.writes.edit(job.id, [
      { type: "add_element", element: makeElementDefinition({ id: "title", kind: "text" }) },
      { type: "place_element", slideId: "slide-1", elementId: "title", placementId: "title-1" },
      { type: "set_slot_value", slideId: "slide-1", placementId: "title-1", value: "BUILD CHEST",
        textColors: [{ start: 6, end: 11, color: "#FF0000" }] },
    ], 0);
    const restored = loadContentProject(new ContentJobRegistry(), job.id, f.stores);
    assert.deepEqual(restored.editor.document, edited.editor.document);
    await assert.rejects(f.writes.edit(job.id, [{ type: "set_text_colors", slideId: "slide-1", placementId: "title-1",
      textColors: [{ start: 6, end: 12, color: "#FF0000" }] }], 1), /부분 색상/);
    assert.deepEqual(f.stores.projects.get(job.id)?.document, edited.editor.document);
    const undone = f.writes.undo(job.id, 1);
    assert.deepEqual(f.stores.projects.get(job.id)?.document, undone.editor.document);
    assert.deepEqual(undone.editor.document, job.editor.document);
  } finally { f.database.close(); }
});

test("MCP 생성·복제·편집·되돌리기는 최신 문서를 저장하고 새 메모리에서 복구한다", async () => {
  const f = fixture();
  try {
    const source = f.seed("Back");
    assert.equal(source.savedRevision, 0);
    assert.equal(f.stores.projects.list().length, 1);
    let notifications = 0;
    f.registry.subscribe(source.id, (job) => {
      notifications++;
      assert.equal(job.savedRevision, job.editor.revision);
      assert.deepEqual(f.stores.projects.get(job.id)?.document, job.editor.document);
    });
    const edited = await f.writes.edit(source.id, [{ type: "rename_slide", slideId: "slide-1", name: "New title" }], 0);
    assert.equal(edited.savedRevision, 1);
    assert.equal(notifications, 1);
    const clone = f.writes.clone({ templateProjectId: source.id });
    assert.deepEqual(clone.editor.document, edited.editor.document);
    assert.equal(f.stores.projects.list().length, 2);
    const restored = loadContentProject(new ContentJobRegistry(), clone.id, f.stores);
    assert.deepEqual(restored.editor.document, clone.editor.document);
    assert.equal(restored.savedRevision, 0);
    const undone = f.writes.undo(source.id, 1);
    assert.equal(undone.savedRevision, 2);
    assert.deepEqual(f.stores.projects.get(source.id)?.document, source.editor.document);
    assert.deepEqual(f.stores.projects.get(clone.id)?.document, edited.editor.document);
    await assert.rejects(f.writes.edit(source.id, [], 0), /변경되었습니다/);
  } finally { f.database.close(); }
});

test("DB 저장 실패는 문서·revision·이력을 복구하고 화면과 목록에 알리지 않는다", async () => {
  const f = fixture();
  const abort = new AbortController();
  const reader = contentProjectEvents(abort.signal).body!.getReader();
  try {
    const job = f.seed("Rollback");
    await f.writes.edit(job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Saved" }], 0);
    // Consume connection, creation, and edit notifications before testing a failed save.
    for (let i = 0; i < 3; i++) assert.equal((await reader.read()).done, false);
    const before = structuredClone(f.registry.getRecord(job.id));
    const stored = f.stores.projects.get(job.id);
    let notifications = 0;
    f.registry.subscribe(job.id, () => { notifications++; });
    f.database.exec(`CREATE TRIGGER fail_save BEFORE UPDATE ON content_projects BEGIN SELECT RAISE(ABORT, 'save failed'); END;`);
    await assert.rejects(f.writes.edit(job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Lost" }], 1), /save failed/);
    assert.throws(() => f.writes.undo(job.id, 1), /save failed/);
    assert.deepEqual(f.registry.getRecord(job.id), before);
    assert.deepEqual(f.stores.projects.get(job.id), stored);
    assert.equal(notifications, 0);
    abort.abort();
    assert.equal((await reader.read()).done, true);
    f.database.exec("DROP TRIGGER fail_save");
    assert.equal(f.writes.undo(job.id, 1).savedRevision, 2);
  } finally { abort.abort(); await reader.cancel(); f.database.close(); }
});

test("실패한 생성은 메모리의 새 작업을 제거한다", () => {
  const f = fixture();
  try {
    const source = f.seed("Template");
    f.database.exec(`CREATE TRIGGER fail_create BEFORE INSERT ON content_projects BEGIN SELECT RAISE(ABORT, 'save failed'); END;`);
    assert.throws(() => f.writes.clone({ templateProjectId: source.id, name: "Failed" }), /save failed/);
    assert.equal(f.registry.list().length, 1);
    assert.equal(f.stores.projects.list().length, 1);
  } finally { f.database.close(); }
});

test("이미지 포함 편집의 저장 실패도 신규 이미지 등록을 롤백하고 반복 저장은 이미지 바이트를 다시 쓰지 않는다", async () => {
  const f = fixture();
  const directory = await mkdtemp(join(tmpdir(), "studio-autosave-"));
  try {
    const path = join(directory, "image.png");
    await writeFile(path, await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } }).png().toBuffer());
    const job = f.seed("Images");
    const commands = [
      { type: "add_element" as const, element: makeElementDefinition({ id: "photo", kind: "image" }) },
      { type: "place_element" as const, slideId: "slide-1", elementId: "photo", placementId: "photo-1" },
      { type: "set_local_image" as const, slideId: "slide-1", placementId: "photo-1", localPath: path },
    ];
    f.database.exec(`CREATE TRIGGER fail_save BEFORE UPDATE ON content_projects BEGIN SELECT RAISE(ABORT, 'save failed'); END;`);
    await assert.rejects(f.writes.edit(job.id, commands, 0), /save failed/);
    assert.equal(Object.keys(f.registry.getRecord(job.id).imageData).length, 0);
    assert.deepEqual(f.registry.get(job.id), job);
    f.database.exec("DROP TRIGGER fail_save");
    const edited = await f.writes.edit(job.id, commands, 0);
    const fresh = loadContentProject(new ContentJobRegistry(), job.id, f.stores);
    assert.deepEqual(fresh.editor.document, edited.editor.document);
    assert.ok(f.stores.projects.get(job.id)?.assets[0].bytes.length);
    f.database.exec(`
      CREATE TRIGGER forbid_asset_update BEFORE UPDATE ON content_project_assets BEGIN SELECT RAISE(ABORT, 'rewrote image'); END;
      CREATE TRIGGER forbid_asset_delete BEFORE DELETE ON content_project_assets BEGIN SELECT RAISE(ABORT, 'deleted image'); END;
    `);
    await f.writes.edit(job.id, [{ type: "rename_slide", slideId: "slide-1", name: "Text change" }], 1);
    assert.equal(f.stores.projects.get(job.id)?.assets.length, 1);
    f.database.exec("DROP TRIGGER forbid_asset_delete");
    await f.writes.edit(job.id, [{ type: "remove_placement", slideId: "slide-1", placementId: "photo-1" }], 2);
    assert.equal(f.stores.projects.get(job.id)?.assets.length, 0);
  } finally { f.database.close(); await rm(directory, { recursive: true, force: true }); }
});
