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

const guide = {
  contentRole: "운동 루틴 구성", readerOutcome: "운동을 선택하고 수행량을 정한다",
  requiredInformation: "운동 그룹, 선택지, 세트·횟수", selectionCriteria: "실제 루틴 구성 요청에 적합하며 순위 평가와 구분한다",
};

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
    assert.equal(store.getSummary("old")?.reuseGuide, null);
    assert.equal(store.getSummary("old")?.isTemplate, false);
    assert.throws(() => store.updateReuse("old", { isTemplate: true }), /가이드/);
    store.updateReuse("old", { reuseGuide: { ...guide, contentRole: " 운동 루틴 구성 " }, isTemplate: true });
    assert.equal(store.listTemplates().length, 1);
    assert.equal(store.list().length, 1, "등록은 원본 복사본을 만들지 않는다");
    store.save({ id: "old", name: "Renamed", aspectRatio: "4:5", slideCount: 2,
      outputLanguage: "English", document: { slides: ["latest"] }, assets: [] });
    db.close();
    const reopened = openLocalDatabase(path);
    try {
      const persisted = new ContentProjectStore(reopened);
      assert.equal(persisted.listTemplates()[0].name, "Renamed");
      assert.deepEqual(persisted.listTemplates()[0].reuseGuide, guide);
      assert.equal("document" in persisted.listTemplates()[0], false);
      assert.equal("assets" in persisted.listTemplates()[0], false);
      assert.throws(() => persisted.updateReuse("old", { reuseGuide: null }), /가이드/);
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
    store.updateReuse(source.id, { reuseGuide: guide, isTemplate: true });
    await writes.edit(source.id, [{ type: "rename_slide", slideId: "slide-1", name: "Latest hook" }], 0);
    const clone = writes.clone({ templateProjectId: source.id, name: "Chest" });
    assert.equal(clone.editor.document.slides[0].name, "Latest hook");
    assert.deepEqual(store.getSummary(clone.id)?.reuseGuide, store.getSummary(source.id)?.reuseGuide);
    assert.equal(store.getSummary(clone.id)?.isTemplate, false);
    await writes.edit(clone.id, [{ type: "rename_slide", slideId: "slide-1", name: "Chest hook" }], 0);
    assert.equal(registry.get(source.id).editor.document.slides[0].name, "Latest hook");
    store.updateReuse(source.id, { isTemplate: false });
    assert.throws(() => writes.clone({ templateProjectId: source.id }), /등록된/);
    assert.throws(() => writes.clone({ templateProjectId: "missing" }), /등록된/);
    assert.equal(store.list().length, 2);
  } finally { db.close(); }
});

test("자유문 가이드는 원문을 보존해 네 필드로 이전하고 미완성 템플릿 복제를 차단한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const registry = new ContentJobRegistry();
    const store = new ContentProjectStore(db);
    const stores = { projects: store };
    const source = createContentProject(registry, { name: "Legacy" }, stores);
    saveContentProject(registry, source.id, "Legacy", stores);
    const original = store.get(source.id)!;
    // Reconstruct the previous schema, including an already registered template.
    db.exec(`ALTER TABLE content_projects ADD COLUMN reuse_guide TEXT NOT NULL DEFAULT ''`);
    for (const column of ["reuse_content_role", "reuse_reader_outcome", "reuse_required_information", "reuse_selection_criteria"])
      db.exec(`ALTER TABLE content_projects DROP COLUMN ${column}`);
    const prose = "Legacy prose without explicit field boundaries. ".repeat(30);
    db.prepare("UPDATE content_projects SET reuse_guide = ?, is_template = 1 WHERE id = ?").run(prose, source.id);
    const migrated = new ContentProjectStore(db);
    const saved = migrated.get(source.id)!;
    assert.deepEqual(saved.reuseGuide, { contentRole: prose, readerOutcome: "", requiredInformation: "", selectionCriteria: "" });
    assert.equal(saved.isTemplate, true);
    assert.deepEqual(saved.document, original.document);
    assert.deepEqual(saved.assets, original.assets);
    assert.equal(saved.updatedAt, original.updatedAt);
    assert.equal((db.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>).some(column => column.name === "reuse_guide"), false);
    assert.throws(() => new McpProjectWrites(registry, db).clone({ templateProjectId: source.id }), /네 항목/);
    migrated.updateReuse(source.id, { reuseGuide: guide });
    assert.deepEqual(new ContentProjectStore(db).getSummary(source.id)?.reuseGuide, guide, "마이그레이션 재실행은 작성한 필드를 덮어쓰지 않는다");
    const cloned = new McpProjectWrites(registry, db).clone({ templateProjectId: source.id });
    assert.deepEqual(migrated.getSummary(cloned.id)?.reuseGuide, guide);
  } finally { db.close(); }
});
