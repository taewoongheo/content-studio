import type Database from "better-sqlite3";
import type { EditorAsset } from "../../domain/types";

export type SavedSlideshowAsset = { assetId: string; name: string; type: EditorAsset["type"]; bytes: Buffer };
/** Used inside the owner's transaction. Preserve unchanged blobs and remove only unused assets. */
export function saveAssets(database: Database.Database, id: string, assets: SavedSlideshowAsset[]) {
  const retained = new Set(assets.map(asset => asset.assetId));
  const previous = database.prepare(`SELECT asset_id FROM content_project_assets WHERE project_id = ?`).all(id) as Array<{ asset_id: string }>;
  const remove = database.prepare(`DELETE FROM content_project_assets WHERE project_id = ? AND asset_id = ?`);
  for (const asset of previous) if (!retained.has(asset.asset_id)) remove.run(id, asset.asset_id);
  const insert = database.prepare(`INSERT INTO content_project_assets (project_id, asset_id, name, mime_type, byte_size, data) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, asset_id) DO UPDATE SET name = excluded.name, mime_type = excluded.mime_type,
    byte_size = excluded.byte_size, data = excluded.data
    WHERE name IS NOT excluded.name OR mime_type IS NOT excluded.mime_type OR byte_size IS NOT excluded.byte_size OR data IS NOT excluded.data`);
  for (const asset of assets) {
    if (!asset.assetId.trim() || !asset.name.trim() || !asset.bytes.length) throw new Error("이미지 자산이 올바르지 않습니다.");
    insert.run(id, asset.assetId, asset.name, asset.type, asset.bytes.length, asset.bytes);
  }
}
export function readAssets(database: Database.Database, id: string): SavedSlideshowAsset[] {
  const rows = database.prepare(`SELECT asset_id, name, mime_type, data FROM content_project_assets WHERE project_id = ? ORDER BY asset_id`)
    .all(id) as Array<{ asset_id: string; name: string; mime_type: EditorAsset["type"]; data: Buffer }>;
  return rows.map(row => ({ assetId: row.asset_id, name: row.name, type: row.mime_type, bytes: row.data }));
}
export function readAsset(database: Database.Database, id: string, assetId: string) {
  const row = database.prepare(`SELECT mime_type, data FROM content_project_assets WHERE project_id = ? AND asset_id = ?`).get(id, assetId) as
    { mime_type: EditorAsset["type"]; data: Buffer } | undefined;
  return row ? { type: row.mime_type, bytes: row.data } : null;
}
