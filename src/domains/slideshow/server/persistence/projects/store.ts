import type Database from "better-sqlite3";
import { SlideshowMetadataError } from "@/domains/slideshow/domain/errors";
import { contentMetadataSchema, type ContentMetadata } from "@/domains/slideshow/projects/metadata";
import { saveAssets, readAssets, readAsset, type SavedSlideshowAsset } from "../assets";

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
  topic: string;
  message: string;
  document_json: string;
  created_at: string;
  updated_at: string;
};

const SUMMARY_COLUMNS = `id, name, aspect_ratio, slide_count, output_language, topic, message, created_at, updated_at`;
const PROJECT_COLUMNS = `${SUMMARY_COLUMNS}, document_json`;

function summary(row: ProjectRow): SavedProjectSummary {
  return {
    id: row.id,
    name: row.name,
    aspectRatio: row.aspect_ratio,
    slideCount: row.slide_count,
    outputLanguage: row.output_language,
    topic: row.topic,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContentProjectStore {
  constructor(readonly database: Database.Database) {}

  updateMetadata(id: string, input: ContentMetadata) {
    const metadata = contentMetadataSchema.parse(input);
    return this.database.transaction(() => {
      const project = this.getSummary(id);
      if (!project) throw new SlideshowMetadataError("PROJECT_NOT_FOUND");
      this.database.prepare("UPDATE content_projects SET topic = ?, message = ?, updated_at = ? WHERE id = ?")
        .run(metadata.topic, metadata.message, new Date().toISOString(), id);
      return this.getSummary(id)!;
    })();
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
      saveAssets(this.database, input.id, input.assets);
    })();
    return this.getSummary(input.id)!;
  }

  getAsset(projectId: string, assetId: string) {
    return readAsset(this.database, projectId, assetId);
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
      assets: readAssets(this.database, id),
    };
  }
}
