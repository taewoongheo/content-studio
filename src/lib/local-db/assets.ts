import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";

export type ImageMimeType = "image/png" | "image/jpeg" | "image/webp";

export type StoredAsset = {
  id: string;
  name: string;
  description: string;
  type: ImageMimeType;
  size: number;
  createdAt: string;
  updatedAt: string;
};

type AssetRow = {
  id: string;
  name: string;
  description: string;
  mime_type: ImageMimeType;
  byte_size: number;
  created_at: string;
  updated_at: string;
};

const ASSET_COLUMNS = "id, name, description, mime_type, byte_size, created_at, updated_at";

function toAsset(row: AssetRow): StoredAsset {
  return {
    id: row.id, name: row.name, description: row.description,
    type: row.mime_type, size: row.byte_size,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class AssetStore {
  constructor(private readonly database: Database.Database) {}

  create(input: {
    name: string;
    description?: string;
    type: ImageMimeType;
    bytes: Uint8Array;
  }): StoredAsset {
    if (!input.name.trim() || input.bytes.byteLength === 0) throw new Error("이미지 이름과 데이터가 필요합니다.");
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO assets (id, name, description, mime_type, byte_size, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.name.trim(), input.description?.trim() ?? "", input.type, input.bytes.byteLength,
      Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength), now, now);
    return this.get(id)!;
  }

  get(id: string): StoredAsset | null {
    const row = this.database.prepare(`SELECT ${ASSET_COLUMNS} FROM assets WHERE id = ?`).get(id) as AssetRow | undefined;
    return row ? toAsset(row) : null;
  }

  list(): StoredAsset[] {
    const rows = this.database.prepare(`SELECT ${ASSET_COLUMNS} FROM assets ORDER BY created_at DESC, id DESC`).all() as AssetRow[];
    return rows.map(toAsset);
  }

  readImage(id: string): { bytes: Buffer; type: ImageMimeType } | null {
    const row = this.database.prepare("SELECT data, mime_type FROM assets WHERE id = ?")
      .get(id) as { data: Buffer; mime_type: ImageMimeType } | undefined;
    return row ? { bytes: row.data, type: row.mime_type } : null;
  }

  updateMetadata(id: string, fields: { name: string; description: string }) {
    if (!fields.name.trim()) throw new Error("이미지 이름이 필요합니다.");
    this.database.prepare("UPDATE assets SET name = ?, description = ?, updated_at = ? WHERE id = ?")
      .run(fields.name.trim(), fields.description.trim(), new Date().toISOString(), id);
    return this.get(id);
  }

  delete(id: string) {
    const primary = this.database.prepare("SELECT 1 FROM characters WHERE turnaround_asset_id = ?").get(id);
    if (primary) throw new Error("캐릭터의 필수 턴어라운드는 삭제할 수 없습니다. 캐릭터를 먼저 삭제해 주세요.");
    return this.database.prepare("DELETE FROM assets WHERE id = ?").run(id).changes > 0;
  }
}
