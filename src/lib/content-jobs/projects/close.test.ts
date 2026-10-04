import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { AssetStore } from "@/lib/local-db/assets";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { ContentJobRegistry } from "../workflow/registry";
import { EditorService } from "../editor/service";
import { closeProjectTab } from "./close";
import { createContentProject, loadContentProject } from "./service";
import { contentJobEvents } from "../http/events";

function fixture() {
  const database = openLocalDatabase(":memory:");
  const registry = new ContentJobRegistry();
  const stores = { projects: new ContentProjectStore(database), assets: new AssetStore(database) };
  return { database, registry, stores };
}

test("닫기는 최신 문서를 저장하고 탭·이력을 해제하며 재열기는 새 탭이다", async () => {
  const f = fixture();
  try {
    const first = f.registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
    const second = f.registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
    const stream = contentJobEvents(f.registry, first.id, new AbortController().signal).body!.getReader();
    await stream.read();
    new EditorService(f.registry).applyCommands(first.id, [{ type: "rename_slide", slideId: "slide-1", name: "Saved on close" }], 0);
    await stream.read();
    closeProjectTab(f.registry, first.id, first.tabId, 1, f.database, f.stores);
    assert.match(new TextDecoder().decode((await stream.read()).value), /event: closed/);
    assert.equal((await stream.read()).done, true);
    assert.equal(f.registry.has(first.id), false);
    assert.deepEqual(f.registry.tabs().map(tab => tab.tabId), [second.tabId]);
    const reopened = loadContentProject(f.registry, first.id, f.stores);
    assert.notEqual(reopened.tabId, first.tabId);
    assert.equal(reopened.editor.document.slides[0].name, "Saved on close");
    assert.equal(f.registry.getRecord(first.id).editorHistory.length, 0);
    assert.equal(loadContentProject(f.registry, first.id, f.stores).tabId, reopened.tabId);
    assert.throws(() => f.registry.requireTab(first.id, first.tabId), /종료/);
    const before = f.registry.tabs().length;
    closeProjectTab(f.registry, first.id, reopened.tabId, 0, f.database, f.stores);
    const clone = createContentProject(f.registry, { sourceProjectId: first.id }, f.stores);
    assert.equal(f.registry.has(first.id), false);
    assert.equal(f.registry.tabs().length, before);
    assert.equal(clone.editor.document.slides[0].name, "Saved on close");
  } finally { f.database.close(); }
});

test("저장 실패·revision 충돌은 탭과 문서·이력을 유지하고 닫힘 알림을 보내지 않는다", () => {
  const f = fixture();
  try {
    const job = f.registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
    let closed = false;
    f.registry.subscribe(job.id, () => {}, () => { closed = true; });
    const before = structuredClone(f.registry.getRecord(job.id));
    f.database.exec("CREATE TRIGGER fail_save BEFORE INSERT ON content_projects BEGIN SELECT RAISE(ABORT, 'save failed'); END;");
    assert.throws(() => closeProjectTab(f.registry, job.id, job.tabId, 0, f.database, f.stores), /save failed/);
    assert.deepEqual(f.registry.getRecord(job.id), before);
    assert.equal(closed, false);
    assert.throws(() => closeProjectTab(f.registry, job.id, job.tabId, 1, f.database, f.stores), /변경/);
    assert.equal(f.stores.projects.list().length, 0);
  } finally { f.database.close(); }
});

test("이미지 준비 중 닫았다 재열면 이전 탭의 요청은 새 탭과 DB 자산을 변경하지 않는다", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { McpProjectWrites } = await import("@/lib/mcp/tools/project-writes");
  const { makeElementDefinition } = await import("../editor/elements/factory");
  const sharp = (await import("sharp")).default;
  const f = fixture();
  const directory = await mkdtemp(join(tmpdir(), "tab-race-"));
  try {
    const path = join(directory, "image.png");
    await writeFile(path, await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer());
    const writes = new McpProjectWrites(f.registry, f.database);
    const job = writes.create({ name: "Pending image" });
    const pending = writes.edit(job.id, [
      { type: "add_element", element: makeElementDefinition({ id: "image", kind: "image" }) },
      { type: "place_element", slideId: "slide-1", elementId: "image", placementId: "image-1" },
      { type: "set_local_image", slideId: "slide-1", placementId: "image-1", localPath: path },
    ], 0, job.tabId);
    closeProjectTab(f.registry, job.id, job.tabId, 0, f.database, f.stores);
    const reopened = loadContentProject(f.registry, job.id, f.stores);
    await assert.rejects(pending, /종료/);
    assert.deepEqual(f.registry.get(job.id), reopened);
    assert.deepEqual(f.stores.projects.get(job.id)?.document, job.editor.document);
    assert.equal(f.stores.assets.list().length, 0);
  } finally { f.database.close(); await rm(directory, { recursive: true, force: true }); }
});
