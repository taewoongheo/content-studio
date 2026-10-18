import type Database from "better-sqlite3";
import { TemplateError, contentMetadataSchema, type ContentMetadata } from "@/domains/slideshow/projects/composition";
import { ContentTemplateStore } from "@/domains/slideshow/server/persistence/templates/store";
import { ensureProjectSchema } from "@/domains/slideshow/server/persistence/projects/schema";
import { saveAssets, readAssets, readAsset, type SavedSlideshowAsset } from "../assets";
import { nextTemplateInLoop } from "@/domains/slideshow/projects/planning/next-template";

import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";
export type SavedProjectAsset = SavedSlideshowAsset;

export type SavedProject = SavedProjectSummary & {
  document: unknown;
  assets: SavedProjectAsset[];
};

type ProjectRow = {
  id: string;
  name: string;
  aspect_ratio: string;
  slide_count: number;
  output_language: string;
  source_template_id: string | null;
  source_template_name: string | null;
  topic: string;
  message: string;
  published_at: string | null;
  document_json: string;
  created_at: string;
  updated_at: string;
};

const SUMMARY_COLUMNS = `id, name, aspect_ratio, slide_count, output_language, topic, message, published_at, created_at, updated_at,
  template_id AS source_template_id,
  (SELECT name FROM content_templates WHERE id = content_projects.template_id) AS source_template_name`;
const PROJECT_COLUMNS = `${SUMMARY_COLUMNS}, document_json`;

function summary(row: ProjectRow): SavedProjectSummary {
  return {
    id: row.id,
    name: row.name,
    aspectRatio: row.aspect_ratio,
    slideCount: row.slide_count,
    outputLanguage: row.output_language,
    sourceTemplateId: row.source_template_id,
    sourceTemplateName: row.source_template_name,
    topic: row.topic,
    message: row.message,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContentProjectStore {
  constructor(readonly database: Database.Database) {
    this.ensureSchema();
  }

  private ensureSchema() { ensureProjectSchema(this.database); }

  listTemplates(includeExcluded = false) { return new ContentTemplateStore(this.database).list(includeExcluded); }

  updateMetadata(id: string, input: ContentMetadata) {
    const metadata = contentMetadataSchema.parse(input);
    return this.database.transaction(() => {
      const project = this.getSummary(id);
      if (!project) throw new TemplateError("PROJECT_NOT_FOUND");
      if (metadata.templateId !== undefined) {
        if (metadata.templateId !== null && !new ContentTemplateStore(this.database).get(metadata.templateId))
          throw new TemplateError("INVALID_METADATA", "존재하는 부모 템플릿을 선택해 주세요.");
        this.database.prepare("UPDATE content_projects SET template_id = ? WHERE id = ?").run(metadata.templateId, id);
      }
      this.database.prepare("UPDATE content_projects SET topic = ?, message = ?, updated_at = ? WHERE id = ?")
        .run(metadata.topic, metadata.message, new Date().toISOString(), id);
      return this.getSummary(id)!;
    })();
  }

  setCloneSource(id: string, sourceId: string) {
    const template = new ContentTemplateStore(this.database).get(sourceId);
    if (id === sourceId || !template || template.templateOrder === null)
      throw new TemplateError("INVALID_METADATA", "루프에 등록된 원본 템플릿을 선택해 주세요.");
    this.database.prepare("UPDATE content_projects SET template_id = ? WHERE id = ?").run(sourceId, id);
  }

  publish(id: string) {
    const project = this.getSummary(id);
    if (!project) throw new TemplateError("PROJECT_NOT_FOUND");
    if (project.publishedAt) return project;
    if (!project.topic.trim() || !project.message.trim())
      throw new TemplateError("INVALID_METADATA", "게시 전에 주제와 메시지를 입력해 주세요.");
    this.database.prepare("UPDATE content_projects SET published_at = ? WHERE id = ? AND published_at IS NULL")
      .run(new Date().toISOString(), id);
    return this.getSummary(id)!;
  }

  unpublish(id: string) {
    if (!this.getSummary(id)) throw new TemplateError("PROJECT_NOT_FOUND");
    this.database.prepare("UPDATE content_projects SET published_at = NULL WHERE id = ?").run(id);
  }

  listPublished() {
    return (this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_projects
      WHERE published_at IS NOT NULL ORDER BY published_at DESC, id DESC`).all() as ProjectRow[]).map(summary);
  }

  contentPlan() {
    const templates = this.listTemplates();
    const published = this.listPublished();
    return {
      nextTemplateId: nextTemplateInLoop(templates, published)?.id ?? null,
      templates,
      published,
      unpublished: this.list().filter(project => !project.publishedAt),
    };
  }

  save(input: {
    id: string;
    name: string;
    aspectRatio: string;
    slideCount: number;
    outputLanguage: string;
    document: unknown;
    assets: SavedProjectAsset[];
  }): SavedProjectSummary {
    const name = input.name.trim();
    if (!input.id.trim() || !name || name.length > 120)
      throw new Error("프로젝트 이름을 120자 이하로 입력해 주세요.");
    if (!Number.isInteger(input.slideCount) || input.slideCount < 1)
      throw new Error("프로젝트 슬라이드 수가 올바르지 않습니다.");
    const document = JSON.stringify(input.document);
    const now = new Date().toISOString();
    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO content_projects
          (id, name, aspect_ratio, slide_count, output_language, document_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          aspect_ratio = excluded.aspect_ratio,
          slide_count = excluded.slide_count,
          output_language = excluded.output_language,
          document_json = excluded.document_json,
          updated_at = excluded.updated_at
      `).run(input.id, name, input.aspectRatio, input.slideCount, input.outputLanguage, document, now, now);
      saveAssets(this.database, "project", input.id, input.assets);
    })();
    return this.getSummary(input.id)!;
  }

  getAsset(projectId: string, assetId: string) {
    return readAsset(this.database, "project", projectId, assetId);
  }

  getContent(id: string) {
    const row = this.database.prepare("SELECT name, document_json, output_language FROM content_projects WHERE id = ?")
      .get(id) as Pick<ProjectRow, "name" | "document_json" | "output_language"> | undefined;
    return row ? { name: row.name, document: JSON.parse(row.document_json) as unknown, outputLanguage: row.output_language } : null;
  }

  rename(id: string, requestedName: string) {
    const name = requestedName.trim();
    if (!name || name.length > 120) throw new Error("프로젝트 이름을 120자 이하로 입력해 주세요.");
    this.database.prepare("UPDATE content_projects SET name = ?, updated_at = ? WHERE id = ?")
      .run(name, new Date().toISOString(), id);
  }

  delete(id: string) {
    this.database.prepare("DELETE FROM content_projects WHERE id = ?").run(id);
  }

  list(): SavedProjectSummary[] {
    const rows = this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_projects
      ORDER BY updated_at DESC, id DESC`).all() as ProjectRow[];
    return rows.map(summary);
  }

  getSummary(id: string): SavedProjectSummary | null {
    const row = this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;
    return row ? summary(row) : null;
  }

  get(id: string): SavedProject | null {
    const row = this.database.prepare(`SELECT ${PROJECT_COLUMNS} FROM content_projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;
    if (!row) return null;
    return {
      ...summary(row),
      document: JSON.parse(row.document_json) as unknown,
      assets: readAssets(this.database, "project", id),
    };
  }
}
