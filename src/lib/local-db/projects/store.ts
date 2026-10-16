import type Database from "better-sqlite3";
import { ProjectReuseError, type ProjectReuseUpdate, contentMetadataSchema, type ContentMetadata } from "@/lib/content-jobs/projects/composition";
import { ContentTemplateStore } from "../templates/store";
import { ensureProjectSchema } from "./schema";
import type { EditorAsset } from "../../content-jobs/domain/types";

export type SavedProjectSummary = {
  id: string;
  name: string;
  aspectRatio: string;
  slideCount: number;
  outputLanguage: string;
  composition: string;
  /** Derived from templateOrder; no separate persisted flag. */
  isTemplate: boolean;
  registeredTemplateName: string | null;
  sourceTemplateExcluded: boolean;
  templateOrder: number | null;
  sourceTemplateProjectId: string | null;
  sourceTemplateName: string | null;
  topic: string;
  message: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedProjectAsset = {
  assetId: string;
  name: string;
  type: EditorAsset["type"];
  bytes: Buffer;
};

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
  composition: string;
  template_order: number | null;
  registered_template_name: string | null;
  source_template_order: number | null;
  source_template_project_id: string | null;
  source_template_name: string | null;
  topic: string;
  message: string;
  published_at: string | null;
  document_json: string;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  asset_id: string;
  name: string;
  mime_type: EditorAsset["type"];
  data: Buffer;
};

const SUMMARY_COLUMNS = `id, name, aspect_ratio, slide_count, output_language, topic, message, published_at, created_at, updated_at,
  template_id AS source_template_project_id,
  (SELECT name FROM content_templates WHERE id = content_projects.id) AS registered_template_name,
  COALESCE((SELECT composition FROM content_templates WHERE id = content_projects.id), '') AS composition,
  (SELECT loop_order FROM content_templates WHERE id = content_projects.id) AS template_order,
  (SELECT name FROM content_templates WHERE id = content_projects.template_id) AS source_template_name,
  (SELECT loop_order FROM content_templates WHERE id = content_projects.template_id) AS source_template_order`;
const PROJECT_COLUMNS = `${SUMMARY_COLUMNS}, document_json`;

function summary(row: ProjectRow): SavedProjectSummary {
  return {
    id: row.id,
    name: row.name,
    aspectRatio: row.aspect_ratio,
    slideCount: row.slide_count,
    outputLanguage: row.output_language,
    composition: row.composition,
    isTemplate: row.registered_template_name !== null,
    registeredTemplateName: row.registered_template_name,
    sourceTemplateExcluded: row.source_template_name !== null && row.source_template_order === null,
    templateOrder: row.template_order,
    sourceTemplateProjectId: row.source_template_project_id,
    sourceTemplateName: row.source_template_name,
    topic: row.topic,
    message: row.message,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContentProjectStore {
  constructor(private readonly database: Database.Database) {
    this.ensureSchema();
  }

  private ensureSchema() { ensureProjectSchema(this.database); }

  updateReuse(id: string, input: ProjectReuseUpdate) {
    return new ContentTemplateStore(this.database).update(id, input) ?? this.getSummary(id)!;
  }

  listTemplates(includeExcluded = false) { return new ContentTemplateStore(this.database).list(includeExcluded); }

  updateMetadata(id: string, input: ContentMetadata) {
    const metadata = contentMetadataSchema.parse(input);
    return this.database.transaction(() => {
      const project = this.getSummary(id);
      if (!project) throw new ProjectReuseError("PROJECT_NOT_FOUND");
      if (metadata.templateId !== undefined) {
        if (metadata.templateId !== null && project.isTemplate)
          throw new ProjectReuseError("INVALID_METADATA", "템플릿으로 등록된 콘텐츠는 부모를 지정할 수 없습니다.");
        if (metadata.templateId !== null && !new ContentTemplateStore(this.database).get(metadata.templateId))
          throw new ProjectReuseError("INVALID_METADATA", "존재하는 부모 템플릿을 선택해 주세요.");
        this.database.prepare("UPDATE content_projects SET template_id = ? WHERE id = ?").run(metadata.templateId, id);
      }
      this.database.prepare("UPDATE content_projects SET topic = ?, message = ?, updated_at = ? WHERE id = ?")
        .run(metadata.topic, metadata.message, new Date().toISOString(), id);
      return this.getSummary(id)!;
    })();
  }

  setCloneSource(id: string, sourceId: string) {
    const template = new ContentTemplateStore(this.database).get(sourceId);
    if (id === sourceId || !template || template.templateOrder === null || this.getSummary(id)?.isTemplate)
      throw new ProjectReuseError("INVALID_METADATA", "루프에 등록된 원본 템플릿을 선택해 주세요.");
    this.database.prepare("UPDATE content_projects SET template_id = ? WHERE id = ?").run(sourceId, id);
  }

  publish(id: string) {
    const project = this.getSummary(id);
    if (!project) throw new ProjectReuseError("PROJECT_NOT_FOUND");
    if (project.publishedAt) return project;
    if (!project.topic.trim() || !project.message.trim())
      throw new ProjectReuseError("INVALID_METADATA", "게시 전에 주제와 메시지를 입력해 주세요.");
    this.database.prepare("UPDATE content_projects SET published_at = ? WHERE id = ? AND published_at IS NULL")
      .run(new Date().toISOString(), id);
    return this.getSummary(id)!;
  }

  unpublish(id: string) {
    if (!this.getSummary(id)) throw new ProjectReuseError("PROJECT_NOT_FOUND");
    this.database.prepare("UPDATE content_projects SET published_at = NULL WHERE id = ?").run(id);
  }

  listPublished() {
    return (this.database.prepare(`SELECT ${SUMMARY_COLUMNS} FROM content_projects
      WHERE published_at IS NOT NULL ORDER BY published_at DESC, id DESC`).all() as ProjectRow[]).map(summary);
  }

  contentPlan() {
    const templates = this.listTemplates();
    const published = this.listPublished();
    const latest = published.find(project => templates.some(template =>
      template.id === (project.sourceTemplateProjectId ?? project.id)));
    const lastIndex = latest ? templates.findIndex(template => template.id === (latest.sourceTemplateProjectId ?? latest.id)) : -1;
    return {
      nextTemplateId: templates.length ? templates[(lastIndex + 1) % templates.length].id : null,
      templates,
      published,
      unpublished: this.list().filter(project => !project.isTemplate && !project.publishedAt),
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
      const retained = new Set(input.assets.map((asset) => asset.assetId));
      const previous = this.database.prepare("SELECT asset_id FROM content_project_assets WHERE project_id = ?")
        .all(input.id) as Array<{ asset_id: string }>;
      const removeAsset = this.database.prepare("DELETE FROM content_project_assets WHERE project_id = ? AND asset_id = ?");
      for (const asset of previous) if (!retained.has(asset.asset_id)) removeAsset.run(input.id, asset.asset_id);
      const insertAsset = this.database.prepare(`
        INSERT INTO content_project_assets
          (project_id, asset_id, name, mime_type, byte_size, data)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, asset_id) DO UPDATE SET
          name = excluded.name, mime_type = excluded.mime_type,
          byte_size = excluded.byte_size, data = excluded.data
        WHERE name IS NOT excluded.name
          OR mime_type IS NOT excluded.mime_type OR byte_size IS NOT excluded.byte_size OR data IS NOT excluded.data
      `);
      for (const asset of input.assets) {
        if (!asset.assetId.trim() || !asset.name.trim() || asset.bytes.byteLength === 0)
          throw new Error("프로젝트 이미지가 올바르지 않습니다.");
        insertAsset.run(input.id, asset.assetId, asset.name, asset.type,
          asset.bytes.byteLength, asset.bytes);
      }
    })();
    return this.getSummary(input.id)!;
  }

  getAsset(projectId: string, assetId: string) {
    const asset = this.database.prepare("SELECT mime_type, data FROM content_project_assets WHERE project_id = ? AND asset_id = ?")
      .get(projectId, assetId) as { mime_type: string; data: Buffer } | undefined;
    return asset ? { type: asset.mime_type, bytes: asset.data } : null;
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
    if (new ContentTemplateStore(this.database).get(id))
      throw new ProjectReuseError("SOURCE_IN_USE", "템플릿 설정을 먼저 삭제해 주세요. 원본 콘텐츠를 삭제하면 템플릿을 사용할 수 없습니다.");
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
    const assets = this.database.prepare(`SELECT asset_id, name, mime_type, data
      FROM content_project_assets WHERE project_id = ? ORDER BY asset_id`)
      .all(id) as AssetRow[];
    return {
      ...summary(row),
      document: JSON.parse(row.document_json) as unknown,
      assets: assets.map((asset) => ({
        assetId: asset.asset_id,
        name: asset.name,
        type: asset.mime_type,
        bytes: asset.data,
      })),
    };
  }
}
