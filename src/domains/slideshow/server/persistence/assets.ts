import type Database from "better-sqlite3";
import type { EditorAsset } from "../../domain/types";

export type SavedSlideshowAsset = { assetId: string; name: string; type: EditorAsset["type"]; bytes: Buffer };
type Owner = "project" | "template";
const storage = (owner: Owner) => ({ table: owner === "project" ? "content_project_assets" : "content_template_assets", key: `${owner}_id` });

/** Used inside the owner's transaction. Preserve unchanged blobs and remove only unused assets. */
export function saveAssets(database: Database.Database, owner: Owner, id: string, assets: SavedSlideshowAsset[]) {
  const { table, key } = storage(owner);
  const retained = new Set(assets.map(asset => asset.assetId));
  const previous = database.prepare(`SELECT asset_id FROM ${table} WHERE ${key} = ?`).all(id) as Array<{ asset_id: string }>;
  const remove = database.prepare(`DELETE FROM ${table} WHERE ${key} = ? AND asset_id = ?`);
  for (const asset of previous) if (!retained.has(asset.asset_id)) remove.run(id, asset.asset_id);
  const insert = database.prepare(`INSERT INTO ${table} (${key}, asset_id, name, mime_type, byte_size, data) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(${key}, asset_id) DO UPDATE SET name = excluded.name, mime_type = excluded.mime_type,
    byte_size = excluded.byte_size, data = excluded.data
    WHERE name IS NOT excluded.name OR mime_type IS NOT excluded.mime_type OR byte_size IS NOT excluded.byte_size OR data IS NOT excluded.data`);
  for (const asset of assets) {
    if (!asset.assetId.trim() || !asset.name.trim() || !asset.bytes.length) throw new Error("이미지 자산이 올바르지 않습니다.");
    insert.run(id, asset.assetId, asset.name, asset.type, asset.bytes.length, asset.bytes);
  }
}
export function readAssets(database: Database.Database, owner: Owner, id: string): SavedSlideshowAsset[] {
  const { table, key } = storage(owner);
  const rows = database.prepare(`SELECT asset_id, name, mime_type, data FROM ${table} WHERE ${key} = ? ORDER BY asset_id`)
    .all(id) as Array<{ asset_id: string; name: string; mime_type: EditorAsset["type"]; data: Buffer }>;
  return rows.map(row => ({ assetId: row.asset_id, name: row.name, type: row.mime_type, bytes: row.data }));
}
export function readAsset(database: Database.Database, owner: Owner, id: string, assetId: string) {
  const { table, key } = storage(owner);
  const row = database.prepare(`SELECT mime_type, data FROM ${table} WHERE ${key} = ? AND asset_id = ?`).get(id, assetId) as
    { mime_type: EditorAsset["type"]; data: Buffer } | undefined;
  return row ? { type: row.mime_type, bytes: row.data } : null;
}
