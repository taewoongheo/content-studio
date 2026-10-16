import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { openLocalDatabase } from "../database";
import { ContentProjectStore } from "../projects/store";
import { ContentTemplateStore } from "./store";
import { migrateTemplateLoop } from "../projects/migrate-loop";

test("등록은 부모를 해제하고 설정만 독립시키며 제외하면 설정 삭제와 부모 해제를 함께 처리한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    for (const id of ["a", "b", "child"]) {
      projects.save({ id, name: `Post ${id}`, aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: { text: id }, assets: [] });
      projects.updateMetadata(id, { topic: `Topic ${id}`, message: `Message ${id}` });
    }
    templates.update("a", { isTemplate: true, composition: "대안을 비교하는 설명", templateName: "Template A" });
    projects.updateMetadata("b", { topic: "Topic b", message: "Message b", templateId: "a" });
    projects.publish("b");
    const original = projects.get("b")!;
    templates.update("b", { isTemplate: true, composition: "한 가지 핵심 메시지를 설명한다", templateName: "Template B", templateTopic: "Template topic", templateMessage: "Template message" });
    const root = projects.get("b")!;
    assert.equal(root.sourceTemplateProjectId, null);
    assert.equal(root.name, original.name);
    assert.equal(root.topic, original.topic);
    assert.equal(root.message, original.message);
    assert.equal(root.publishedAt, original.publishedAt);
    assert.deepEqual(root.document, original.document);
    assert.equal(templates.get("b")?.name, "Template B");
    assert.equal(templates.get("b")?.topic, "Template topic");
    assert.throws(() => projects.updateMetadata("b", { topic: "Topic", message: "Message", templateId: "a" }), /부모/);
    assert.throws(() => db.prepare("UPDATE content_projects SET template_id = 'a' WHERE id = 'b'").run(), /cannot have a parent/);
    projects.updateMetadata("child", { topic: "Child", message: "Child message", templateId: "b" });
    templates.update("b", { isTemplate: false });
    assert.equal(projects.getSummary("child")?.sourceTemplateProjectId, null);
    assert.equal(projects.getSummary("b")?.isTemplate, false);
    assert.equal(templates.get("b"), null);
    assert.equal(projects.get("b")?.publishedAt, original.publishedAt);
    assert.deepEqual(templates.list().map(item => item.templateOrder), [1]);
    projects.updateMetadata("child", { topic: "Child", message: "Child message", templateId: "a" });
    assert.equal(projects.getSummary("child")?.sourceTemplateName, "Template A");
    projects.updateMetadata("child", { topic: "Child", message: "Child message", templateId: null });
    assert.equal(projects.getSummary("child")?.sourceTemplateProjectId, null);
    assert.equal(projects.getSummary("b")?.isTemplate, false);
    assert.deepEqual(projects.get("b")?.document, original.document);
  } finally { db.close(); }
});

test("드래그 순서는 원자적으로 저장하고 오래된 목록과 누락·중복은 거부한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    for (const id of ["a", "b", "c"]) {
      projects.save({ id, name: id, aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
      templates.update(id, { isTemplate: true, composition: "선택 기준을 설명한다" });
    }
    templates.reorder(["c", "a", "b"], ["a", "b", "c"]);
    assert.deepEqual(templates.list().map(item => item.id), ["c", "a", "b"]);
    assert.throws(() => templates.reorder(["a", "b", "c"], ["a", "b", "c"]), /변경/);
    assert.throws(() => templates.reorder(["c", "a", "a"], ["c", "a", "b"]), /한 번/);
    assert.deepEqual(templates.list().map(item => item.id), ["c", "a", "b"]);
    templates.update("a", { isTemplate: false });
    assert.deepEqual(templates.list().map(item => item.id), ["c", "b"]);
    templates.update("a", { isTemplate: true, composition: "선택 기준을 설명한다" });
    assert.deepEqual(templates.list().map(item => item.id), ["c", "b", "a"]);
  } finally { db.close(); }
});

test("최초 등록에서 요청한 순서를 보존하고 범위 밖 순서는 원자적으로 거부한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    for (const id of ["a", "b", "c", "invalid"]) {
      projects.save({ id, name: id, aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: {}, assets: [] });
    }
    templates.update("a", { isTemplate: true, composition: "비교 카드" });
    templates.update("b", { isTemplate: true, composition: "비교 카드", templateOrder: 1 });
    assert.deepEqual(templates.list().map(item => item.id), ["b", "a"]);
    templates.update("c", { isTemplate: true, composition: "비교 카드", templateOrder: 2 });
    assert.deepEqual(templates.list().map(item => [item.id, item.templateOrder]), [["b", 1], ["c", 2], ["a", 3]]);
    const before = templates.list();
    assert.throws(() => templates.update("invalid", { isTemplate: true, composition: "비교 카드", templateOrder: 5 }), /범위/);
    assert.deepEqual(templates.list(), before);
    assert.equal(templates.get("invalid"), null);
  } finally { db.close(); }
});

test("v8 전환은 제외된 부모도 보존하고 등록된 콘텐츠의 부모만 해제한다", () => {
  const db = new Database(":memory:");
  try {
    db.exec(`CREATE TABLE content_projects (
      id TEXT PRIMARY KEY, name TEXT, aspect_ratio TEXT, slide_count INTEGER, output_language TEXT,
      document_json TEXT, composition TEXT, template_order INTEGER, template_color TEXT,
      source_template_project_id TEXT REFERENCES content_projects(id), topic TEXT, message TEXT,
      published_at TEXT, created_at TEXT, updated_at TEXT);
      INSERT INTO content_projects VALUES ('a','Original A','4:5',1,'English','{}','A guide',NULL,'#123456',NULL,'A topic','A message',NULL,'1','1');
      INSERT INTO content_projects VALUES ('b','Original B','4:5',1,'English','{}','B guide',1,'#654321','a','B topic','B message','2026-10-13T00:00:00.000Z','2','2');
      INSERT INTO content_projects VALUES ('child','Child','4:5',1,'English','{}','',NULL,'#2563EB','a','C topic','C message',NULL,'3','3');
      PRAGMA user_version=8;`);
    migrateTemplateLoop(db);
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    assert.equal(templates.get("a")?.templateOrder, null);
    assert.equal(projects.getSummary("child")?.sourceTemplateProjectId, "a");
    assert.equal(projects.getSummary("b")?.sourceTemplateProjectId, null);
    assert.equal(projects.getSummary("b")?.publishedAt, "2026-10-13T00:00:00.000Z");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    const columns = (db.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>).map(item => item.name);
    assert.ok(columns.includes("template_id"));
    for (const removed of ["composition", "template_order", "template_color", "source_template_project_id"]) assert.ok(!columns.includes(removed));
  } finally { db.close(); }
});

test("v9 색상 제거는 템플릿 설정·부모 연결·게시 시각·문서를 보존한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    for (const id of ["source", "child"]) {
      projects.save({ id, name: id, aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: { text: id }, assets: [] });
      projects.updateMetadata(id, { topic: id, message: `${id} message` });
    }
    templates.update("source", { isTemplate: true, composition: "대안을 비교한다." });
    projects.updateMetadata("child", { topic: "child", message: "child message", templateId: "source" });
    projects.publish("child");
    db.exec("ALTER TABLE content_templates ADD COLUMN color TEXT NOT NULL DEFAULT '#123456'; CREATE TABLE published_posts (id TEXT PRIMARY KEY); PRAGMA user_version=9;");
    const beforeProjects = db.prepare("SELECT * FROM content_projects ORDER BY id").all();
    const beforeTemplates = templates.list(true);
    migrateTemplateLoop(db);
    assert.deepEqual(db.prepare("SELECT * FROM content_projects ORDER BY id").all(), beforeProjects);
    assert.deepEqual(templates.list(true), beforeTemplates);
    assert.ok(!(db.prepare("PRAGMA table_info(content_templates)").all() as Array<{ name: string }>).some(column => column.name === "color"));
    assert.equal(db.pragma("user_version", { simple: true }), 10);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'published_posts'").get(), undefined);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});

test("v9 게시 기록이 있으면 색상·게시 테이블·버전을 바꾸기 전에 중단한다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    db.exec(`ALTER TABLE content_templates ADD COLUMN color TEXT NOT NULL DEFAULT '#123456';
      CREATE TABLE published_posts (id TEXT PRIMARY KEY);
      INSERT INTO published_posts VALUES ('existing'); PRAGMA user_version=9;`);
    const before = db.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all();
    assert.throws(() => migrateTemplateLoop(db), /기존 게시 기록/);
    assert.deepEqual(db.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all(), before);
    assert.deepEqual(db.prepare("SELECT * FROM published_posts").all(), [{ id: "existing" }]);
    assert.equal(db.pragma("user_version", { simple: true }), 9);
  } finally { db.close(); }
});


test("제외 중 실패하면 부모 해제와 설정 삭제·순서 변경을 모두 되돌린다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const projects = new ContentProjectStore(db), templates = new ContentTemplateStore(db);
    for (const id of ["a", "b", "child"]) {
      projects.save({ id, name: id, aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document: { id }, assets: [] });
      if (id !== "child") templates.update(id, { isTemplate: true, composition: "선택 기준을 설명한다" });
    }
    projects.updateMetadata("child", { topic: "Child", message: "Message", templateId: "a" });
    projects.publish("child");
    const before = db.prepare("SELECT * FROM content_projects ORDER BY id").all();
    const beforeTemplates = templates.list(true);
    db.exec("CREATE TRIGGER fail_removal BEFORE DELETE ON content_templates BEGIN SELECT RAISE(ABORT, 'test removal failure'); END;");
    assert.throws(() => templates.delete("a"), /test removal failure/);
    assert.deepEqual(db.prepare("SELECT * FROM content_projects ORDER BY id").all(), before);
    assert.deepEqual(templates.list(true), beforeTemplates);
    db.exec("DROP TRIGGER fail_removal");
    templates.delete("a");
    assert.equal(projects.getSummary("child")?.sourceTemplateProjectId, null);
    assert.equal(projects.getSummary("child")?.publishedAt, (before.find(item => (item as { id: string }).id === "child") as { published_at: string }).published_at);
    assert.deepEqual(templates.list().map(item => [item.id, item.templateOrder]), [["b", 1]]);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); }
});
