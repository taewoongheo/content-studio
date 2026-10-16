import type Database from "better-sqlite3";
import { ensureProjectSchema, PROJECT_SCHEMA } from "./schema";

/** Explicit v7/v8/v9 → v10 migration. The CLI backs up first; startup never runs this. */
export function migrateTemplateLoop(database: Database.Database) {
  const version = database.pragma("user_version", { simple: true }) as number;
  if (version > 10) throw new Error("지원하지 않는 DB 버전입니다.");
  const columns = database.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>;
  if (columns.some(column => column.name === "template_id")) {
    database.transaction(() => {
      const templateColumns = database.prepare("PRAGMA table_info(content_templates)").all() as Array<{ name: string }>;
      if (templateColumns.some(column => column.name === "color")) database.exec("ALTER TABLE content_templates DROP COLUMN color;");
      database.pragma("user_version = 10");
    })();
    return;
  }
  const required = ["id", "name", "aspect_ratio", "slide_count", "output_language", "document_json", "composition", "created_at", "updated_at"];
  if (!required.every(name => columns.some(column => column.name === name)) ||
      !columns.some(column => column.name === "is_template" || column.name === "template_order"))
    throw new Error("지원하지 않는 프로젝트 DB 스키마입니다.");
  const legacyPosts = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'published_posts'").get();
  if (legacyPosts && (database.prepare("SELECT count(*) AS count FROM published_posts").get() as { count: number }).count > 0)
    throw new Error("기존 게시 기록이 있습니다. 프로젝트 연결을 확인한 뒤 전환해야 합니다. 변경하지 않았습니다.");
  type Legacy = { id: string; name: string; aspect_ratio: string; slide_count: number; output_language: string;
    document_json: string; composition: string; template_order?: number | null; is_template?: number;
    template_color?: string; source_template_project_id?: string | null; topic?: string; message?: string;
    published_at?: string | null; created_at: string; updated_at: string };
  const projects = database.prepare("SELECT * FROM content_projects ORDER BY created_at, id").all() as Legacy[];
  const parents = new Set(projects.flatMap(project => project.source_template_project_id ? [project.source_template_project_id] : []));
  const templates = projects.filter(project => project.is_template === 1 || project.template_order != null || parents.has(project.id));
  const roots = new Set(templates.map(project => project.id));
  const foreignKeys = database.pragma("foreign_keys", { simple: true });
  // Rebuild only project metadata, with FK enforcement restored and checked before commit.
  database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      const projectDDL = PROJECT_SCHEMA.slice(0, PROJECT_SCHEMA.indexOf("  CREATE TABLE IF NOT EXISTS content_templates"))
        .replace("IF NOT EXISTS content_projects", "content_projects_next");
      database.exec(projectDDL);
      const insertProject = database.prepare(`INSERT INTO content_projects_next
        (id,name,aspect_ratio,slide_count,output_language,document_json,template_id,topic,message,published_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
      for (const project of projects) insertProject.run(project.id, project.name, project.aspect_ratio, project.slide_count,
        project.output_language, project.document_json, roots.has(project.id) ? null : project.source_template_project_id ?? null,
        project.topic ?? "", project.message ?? "", project.published_at ?? null, project.created_at, project.updated_at);
      database.exec(PROJECT_SCHEMA.match(/CREATE TABLE IF NOT EXISTS content_templates[\s\S]*?\n  \);/)![0]);
      const insertTemplate = database.prepare(`INSERT INTO content_templates
        (id,name,topic,message,composition,loop_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
      let legacyOrder = 0;
      templates.forEach(project => insertTemplate.run(project.id, project.name, project.topic || project.name,
        project.message || `${project.name}의 내용을 전달한다.`, project.composition || "원본의 정보 구조와 페이지 흐름을 재사용한다.",
        project.is_template === 1 ? ++legacyOrder : project.template_order ?? null, project.created_at, project.updated_at));
      database.exec("DROP TABLE content_projects; ALTER TABLE content_projects_next RENAME TO content_projects; DROP TABLE IF EXISTS published_posts;");
      ensureProjectSchema(database);
      if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("전환 후 외래키 연결이 올바르지 않습니다. 변경을 되돌렸습니다.");
      database.pragma("user_version = 10");
    })();
  } finally { database.pragma(`foreign_keys = ${foreignKeys ? "ON" : "OFF"}`); }
}
