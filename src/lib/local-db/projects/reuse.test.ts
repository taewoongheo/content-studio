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

test("기존 DB에 가이드와 템플릿 등록을 추가하고 재시작·본문 저장에도 유지한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "studio-reuse-"));
  const path = join(directory, "db.sqlite");
  try {
    const db = openLocalDatabase(path);
    db.exec(`CREATE TABLE content_projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, aspect_ratio TEXT NOT NULL, slide_count INTEGER NOT NULL,
      output_language TEXT NOT NULL, document_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ); INSERT INTO content_projects VALUES ('old', 'Old', '4:5', 2, 'English', '{"slides":[]}', '2026-10-04', '2026-10-04');`);
    const store = new ContentProjectStore(db);
    assert.equal(store.getSummary("old")?.reuseGuide, "");
    assert.equal(store.getSummary("old")?.isTemplate, false);
    assert.throws(() => store.updateReuse("old", { isTemplate: true }), /가이드/);
    store.updateReuse("old", { reuseGuide: " 운동 루틴 ", isTemplate: true });
    assert.equal(store.listTemplates().length, 1);
    assert.equal(store.list().length, 1, "등록은 원본 복사본을 만들지 않는다");
    store.save({ id: "old", name: "Renamed", aspectRatio: "4:5", slideCount: 2,
      outputLanguage: "English", document: { slides: ["latest"] }, assets: [] });
    db.close();
    const reopened = openLocalDatabase(path);
    try {
      const persisted = new ContentProjectStore(reopened);
      assert.equal(persisted.listTemplates()[0].name, "Renamed");
      assert.equal(persisted.listTemplates()[0].reuseGuide, "운동 루틴");
      assert.equal("document" in persisted.listTemplates()[0], false);
      assert.equal("assets" in persisted.listTemplates()[0], false);
      assert.throws(() => persisted.updateReuse("old", { reuseGuide: "" }), /가이드/);
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
    store.updateReuse(source.id, { reuseGuide: "운동 카드와 계정 뱃지가 있는 루틴", isTemplate: true });
    await writes.edit(source.id, [{ type: "rename_slide", slideId: "slide-1", name: "Latest hook" }], 0);
    const clone = writes.clone({ templateProjectId: source.id, name: "Chest" });
    assert.equal(clone.editor.document.slides[0].name, "Latest hook");
    assert.equal(store.getSummary(clone.id)?.reuseGuide, store.getSummary(source.id)?.reuseGuide);
    assert.equal(store.getSummary(clone.id)?.isTemplate, false);
    await writes.edit(clone.id, [{ type: "rename_slide", slideId: "slide-1", name: "Chest hook" }], 0);
    assert.equal(registry.get(source.id).editor.document.slides[0].name, "Latest hook");
    store.updateReuse(source.id, { isTemplate: false });
    assert.throws(() => writes.clone({ templateProjectId: source.id }), /등록된/);
    assert.throws(() => writes.clone({ templateProjectId: "missing" }), /등록된/);
    assert.equal(store.list().length, 2);
  } finally { db.close(); }
});
