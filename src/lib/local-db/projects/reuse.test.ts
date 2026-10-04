import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLocalDatabase } from "../database";
import { ContentProjectStore } from "./store";
import { ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { createContentProject, saveContentProject } from "@/lib/content-jobs/projects/service";
import { McpProjectWrites } from "@/lib/mcp/tools/project-writes";

const guide = "도입 후 그룹별로 여러 선택지를 함께 보여주고 하나를 선택하도록 안내한다.";

test("구성과 템플릿 등록은 재시작·본문 저장에도 유지된다", () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-reuse-"));
  const path = join(directory, "db.sqlite");
  try {
    const db = openLocalDatabase(path);
    const store = new ContentProjectStore(db);
    store.save({ id: "old", name: "Old", aspectRatio: "4:5", slideCount: 2,
      outputLanguage: "English", document: { slides: [] }, assets: [] });
    assert.equal(store.getSummary("old")?.composition, "");
    assert.equal(store.getSummary("old")?.isTemplate, false);
    assert.throws(() => store.updateReuse("old", { isTemplate: true }), /구성/);
    store.updateReuse("old", { composition: ` ${guide} `, isTemplate: true });
    assert.equal(store.listTemplates().length, 1);
    assert.equal(store.list().length, 1, "등록은 원본 복사본을 만들지 않는다");
    store.save({ id: "old", name: "Renamed", aspectRatio: "4:5", slideCount: 2,
      outputLanguage: "English", document: { slides: ["latest"] }, assets: [] });
    db.close();
    const reopened = openLocalDatabase(path);
    try {
      const persisted = new ContentProjectStore(reopened);
      assert.equal(persisted.listTemplates()[0].name, "Renamed");
      assert.deepEqual(persisted.listTemplates()[0].composition, guide);
      assert.equal("document" in persisted.listTemplates()[0], false);
      assert.equal("assets" in persisted.listTemplates()[0], false);
      assert.throws(() => persisted.updateReuse("old", { composition: "" }), /구성/);
      persisted.updateReuse("old", { isTemplate: false });
      assert.equal(persisted.listTemplates().length, 0);
      assert.ok(persisted.get("old"), "등록 해제는 원본을 보존한다");
      persisted.updateReuse("old", { isTemplate: true });
      persisted.delete("old");
      assert.deepEqual(persisted.listTemplates(), []);
    } finally { reopened.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("복제는 등록된 원본의 최신 구조를 사용하며 가이드는 상속하고 등록 여부는 상속하지 않는다", async () => {
  const db = openLocalDatabase(":memory:");
  try {
    const registry = new ContentJobRegistry();
    const store = new ContentProjectStore(db);
    const stores = { projects: store };
    const source = createContentProject(registry, { name: "Back" }, stores);
    saveContentProject(registry, source.id, "Back", stores);
    const writes = new McpProjectWrites(registry, db);
    assert.throws(() => writes.clone({ templateProjectId: source.id }), /등록된/);
    assert.equal(store.list().length, 1);
    store.updateReuse(source.id, { composition: guide, isTemplate: true });
    await writes.edit(source.id, [{ type: "rename_slide", slideId: "slide-1", name: "Latest hook" }], 0);
    const clone = writes.clone({ templateProjectId: source.id, name: "Chest" });
    assert.equal(clone.editor.document.slides[0].name, "Latest hook");
    assert.deepEqual(store.getSummary(clone.id)?.composition, store.getSummary(source.id)?.composition);
    assert.equal(store.getSummary(clone.id)?.isTemplate, false);
    await writes.edit(clone.id, [{ type: "rename_slide", slideId: "slide-1", name: "Chest hook" }], 0);
    assert.equal(registry.get(source.id).editor.document.slides[0].name, "Latest hook");
    store.updateReuse(source.id, { isTemplate: false });
    assert.throws(() => writes.clone({ templateProjectId: source.id }), /등록된/);
    assert.throws(() => writes.clone({ templateProjectId: "missing" }), /등록된/);
    assert.equal(store.list().length, 2);
  } finally { db.close(); }
});
