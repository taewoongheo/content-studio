import type Database from "better-sqlite3";
import type { ImageMimeType } from "../assets";

export type SavedProjectSummary = {
  id: string;
  name: string;
  aspectRatio: string;
  slideCount: number;
  outputLanguage: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedProjectAsset = {
  assetId: string;
  name: string;
  description: string;
  type: ImageMimeType;
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
  document_json: string;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  asset_id: string;
  name: string;
  description: string;
  mime_type: ImageMimeType;
  data: Buffer;
};

const PROJECT_COLUMNS = "id, name, aspect_ratio, slide_count, output_language, document_json, created_at, updated_at";

function summary(row: ProjectRow): SavedProjectSummary {
  return {
    id: row.id,
    name: row.name,
    aspectRatio: row.aspect_ratio,
    slideCount: row.slide_count,
    outputLanguage: row.output_language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContentProjectStore {
  constructor(private readonly database: Database.Database) {
    this.ensureSchema();
  }

  private ensureSchema() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS content_projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        slide_count INTEGER NOT NULL CHECK (slide_count > 0),
        output_language TEXT NOT NULL,
        document_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS content_projects_updated_at_idx
        ON content_projects(updated_at DESC);
      CREATE TABLE IF NOT EXISTS content_project_assets (
        project_id TEXT NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
        asset_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
        byte_size INTEGER NOT NULL CHECK (byte_size > 0),
        data BLOB NOT NULL,
        PRIMARY KEY (project_id, asset_id)
      );
    `);
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
          (project_id, asset_id, name, description, mime_type, byte_size, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, asset_id) DO UPDATE SET
          name = excluded.name, description = excluded.description, mime_type = excluded.mime_type,
          byte_size = excluded.byte_size, data = excluded.data
        WHERE name IS NOT excluded.name OR description IS NOT excluded.description
          OR mime_type IS NOT excluded.mime_type OR byte_size IS NOT excluded.byte_size OR data IS NOT excluded.data
      `);
      for (const asset of input.assets) {
        if (!asset.assetId.trim() || !asset.name.trim() || asset.bytes.byteLength === 0)
          throw new Error("프로젝트 이미지가 올바르지 않습니다.");
        insertAsset.run(input.id, asset.assetId, asset.name, asset.description, asset.type,
          asset.bytes.byteLength, asset.bytes);
      }
    })();
    return this.getSummary(input.id)!;
  }

  list(): SavedProjectSummary[] {
    const rows = this.database.prepare(`SELECT ${PROJECT_COLUMNS} FROM content_projects
      ORDER BY updated_at DESC, id DESC`).all() as ProjectRow[];
    return rows.map(summary);
  }

  getSummary(id: string): SavedProjectSummary | null {
    const row = this.database.prepare(`SELECT ${PROJECT_COLUMNS} FROM content_projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;
    return row ? summary(row) : null;
  }

  get(id: string): SavedProject | null {
    const row = this.database.prepare(`SELECT ${PROJECT_COLUMNS} FROM content_projects WHERE id = ?`)
      .get(id) as ProjectRow | undefined;
    if (!row) return null;
    const assets = this.database.prepare(`SELECT asset_id, name, description, mime_type, data
      FROM content_project_assets WHERE project_id = ? ORDER BY asset_id`)
      .all(id) as AssetRow[];
    return {
      ...summary(row),
      document: JSON.parse(row.document_json) as unknown,
      assets: assets.map((asset) => ({
        assetId: asset.asset_id,
        name: asset.name,
        description: asset.description,
        type: asset.mime_type,
        bytes: asset.data,
      })),
    };
  }
}
