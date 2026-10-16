import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { openLocalDatabase } from "../database";
import { ContentProjectStore } from "./store";
import { migrateTemplateLoop } from "./migrate-loop";
import { ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { createContentProject, saveContentProject } from "@/lib/content-jobs/projects/service";
import { McpProjectWrites } from "@/lib/mcp/tools/project-writes";

test("순서 이동·등록 해제·복제 출처·게시 기반 다음 차례가 연결된다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const store = new ContentProjectStore(db);
    const registry = new ContentJobRegistry();
    const templates = ["A", "B", "C"].map(name => {
      const job = createContentProject(registry, { name }, { projects: store });
      saveContentProject(registry, job.id, name, { projects: store });
      return store.updateReuse(job.id, { composition: "선택 기준을 짧은 비교 카드로 전달한다.", isTemplate: true });
    });
    const [a, b, c] = templates;
    assert.deepEqual(store.listTemplates().map(project => project.name), ["A", "B", "C"]);
    store.updateReuse(c.id, { templateOrder: 1 });
    assert.deepEqual(store.listTemplates().map(project => project.name), ["C", "A", "B"]);
    assert.equal(store.contentPlan().nextTemplateId, c.id);
    const clone = new McpProjectWrites(registry, db).clone({ templateProjectId: c.id, name: "등 선택", topic: "등 운동", message: "허리 부담을 줄이는 선택 기준을 설명한다." });
    assert.equal(store.getSummary(clone.id)?.sourceTemplateProjectId, c.id);
    assert.equal(store.getSummary(clone.id)?.templateOrder, null);
    assert.equal(store.getSummary(clone.id)?.publishedAt, null);
    assert.equal(store.contentPlan().nextTemplateId, c.id, "제작·저장만으로 게시 차례를 바꾸지 않는다");
    store.publish(clone.id);
    assert.equal(store.contentPlan().nextTemplateId, a.id);
    store.updateReuse(c.id, { templateOrder: null });
    assert.deepEqual(store.listTemplates().map(project => project.templateOrder), [1, 2]);
    assert.equal(store.getSummary(clone.id)?.sourceTemplateName, null, "루프 제외는 부모 연결을 해제한다");
    assert.equal(store.getSummary(c.id)?.isTemplate, false);
    assert.ok(store.get(c.id), "원본 콘텐츠는 유지한다");
    assert.throws(() => new McpProjectWrites(registry, db).clone({ templateProjectId: c.id }), /등록된/);
    assert.throws(() => store.updateReuse(b.id, { templateOrder: 20 }), /범위/);
    assert.deepEqual(store.listTemplates().map(project => project.name), ["A", "B"], "실패한 이동은 순서를 보존한다");
    store.unpublish(clone.id);
    assert.equal(store.listPublished().length, 0);
    assert.ok(store.get(clone.id));
  } finally { db.close(); }
});

function legacy() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(`CREATE TABLE content_projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, aspect_ratio TEXT NOT NULL,
    slide_count INTEGER NOT NULL, output_language TEXT NOT NULL, document_json TEXT NOT NULL,
    composition TEXT NOT NULL DEFAULT '', is_template INTEGER NOT NULL DEFAULT 0 CHECK (is_template IN (0, 1)),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE content_project_assets (project_id TEXT REFERENCES content_projects(id) ON DELETE CASCADE,
      asset_id TEXT, name TEXT, mime_type TEXT, byte_size INTEGER, data BLOB, PRIMARY KEY(project_id,asset_id));
    CREATE TABLE published_posts (id TEXT PRIMARY KEY);
    INSERT INTO content_projects VALUES ('original', 'Original', '4:5', 1, 'English', '{"original":true}', '比較', 1, '2026-01-01', '2026-01-01');
    INSERT INTO content_project_assets VALUES ('original', 'image', 'Image', 'image/png', 3, X'010203');
    PRAGMA user_version = 7;`);
  return db;
}

test("명시적 전환은 원본 문서·이미지를 보존하며 플래그와 빈 게시 테이블만 제거한다", () => {
  const db = legacy();
  try {
    migrateTemplateLoop(db);
    migrateTemplateLoop(db);
    const project = new ContentProjectStore(db).get("original")!;
    assert.deepEqual(project.document, { original: true });
    assert.deepEqual(project.assets[0].bytes, Buffer.from([1, 2, 3]));
    assert.equal(project.templateOrder, 1);
    assert.equal(project.sourceTemplateProjectId, null);
    assert.equal(project.publishedAt, null);
    assert.equal(db.pragma("user_version", { simple: true }), 10);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.deepEqual(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(), [{ name: "content_project_assets" }, { name: "content_projects" }, { name: "content_templates" }]);
    assert.ok(!(db.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>).some(column => column.name === "is_template"));
  } finally { db.close(); }
});

test("기존 게시 기록이 있으면 전환 전에 중단하고 모든 데이터를 보존한다", () => {
  const db = legacy();
  try {
    db.exec("INSERT INTO published_posts VALUES ('existing');");
    const schema = db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all();
    assert.throws(() => migrateTemplateLoop(db), /기존 게시 기록/);
    assert.deepEqual(db.prepare("SELECT sql FROM sqlite_master ORDER BY name").all(), schema);
    assert.equal(db.pragma("user_version", { simple: true }), 7);
  } finally { db.close(); }
});
