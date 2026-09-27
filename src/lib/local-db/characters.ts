import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { AssetStore, type ImageMimeType } from "./assets";

export type StoredCharacter = {
  id: string;
  description: string;
  turnaroundAssetId: string | null;
  createdAt: string;
  updatedAt: string;
};

type CharacterRow = {
  id: string;
  description: string;
  turnaround_asset_id: string | null;
  created_at: string;
  updated_at: string;
};

function toCharacter(row: CharacterRow): StoredCharacter {
  return { id: row.id, description: row.description, turnaroundAssetId: row.turnaround_asset_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class CharacterStore {
  constructor(private readonly database: Database.Database) {}

  create(input: { description: string; type: ImageMimeType; bytes: Uint8Array }) {
    if (!input.description.trim() || !input.bytes.byteLength)
      throw new Error("캐릭터 설명과 턴어라운드 이미지가 필요합니다.");
    return this.database.transaction(() => {
      const id = randomUUID();
      const now = new Date().toISOString();
      const asset = new AssetStore(this.database).create({
        name: "턴어라운드", description: input.description,
        type: input.type, bytes: input.bytes,
      });
      this.database.prepare("INSERT INTO characters (id, name, description, turnaround_asset_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(id, "", input.description.trim(), asset.id, now, now);
      return this.get(id)!;
    })();
  }

  get(id: string): StoredCharacter | null {
    const row = this.database.prepare("SELECT * FROM characters WHERE id = ?").get(id) as CharacterRow | undefined;
    return row ? toCharacter(row) : null;
  }

  list(): StoredCharacter[] {
    const rows = this.database.prepare("SELECT * FROM characters ORDER BY created_at DESC, id DESC").all() as CharacterRow[];
    return rows.map(toCharacter);
  }

  update(id: string, description: string) {
    if (!description.trim()) throw new Error("캐릭터 설명이 필요합니다.");
    this.database.prepare("UPDATE characters SET description = ?, updated_at = ? WHERE id = ?")
      .run(description.trim(), new Date().toISOString(), id);
    return this.get(id);
  }

  delete(id: string) {
    return this.database.prepare("DELETE FROM characters WHERE id = ?").run(id).changes > 0;
  }
}
