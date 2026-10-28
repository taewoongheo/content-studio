import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { productSchema, type Product, type ProductInput } from "../../domain/product";

interface ProductRow { id: string; document_json: string; revision: number; active: number; created_at: string; updated_at: string }
function decode(row: ProductRow): Product {
  return { ...JSON.parse(row.document_json), id: row.id, revision: row.revision, active: !!row.active, created_at: row.created_at, updated_at: row.updated_at };
}
export function listProducts(db: Database.Database) {
  return (db.prepare("SELECT * FROM content_products ORDER BY created_at,id").all() as ProductRow[]).map(decode);
}
export function activeProduct(db: Database.Database) {
  const row = db.prepare("SELECT * FROM content_products WHERE active=1").get() as ProductRow | undefined;
  return row ? decode(row) : null;
}
export function saveProduct(db: Database.Database, data: ProductInput, id?: string, revision?: number) {
  const document = JSON.stringify(productSchema.parse(data));
  const now = new Date().toISOString();
  if (id) {
    const result = db.prepare("UPDATE content_products SET document_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").run(document, now, id, revision ?? -1);
    if (!result.changes) throw new Error("제품 정보가 변경되었습니다. 새로고침 후 다시 수정해 주세요.");
    return id;
  }
  const productId = randomUUID();
  db.prepare("INSERT INTO content_products(id,document_json,revision,active,created_at,updated_at) VALUES(?,?,1,?,?,?)")
    .run(productId, document, activeProduct(db) ? 0 : 1, now, now);
  return productId;
}
export function selectProduct(db: Database.Database, id: string) {
  db.transaction(() => {
    if (!db.prepare("SELECT id FROM content_products WHERE id=?").get(id)) throw new Error("제품을 찾을 수 없습니다.");
    db.prepare("UPDATE content_products SET active=0 WHERE active=1").run();
    db.prepare("UPDATE content_products SET active=1 WHERE id=?").run(id);
  })();
}
export function deleteProduct(db: Database.Database, id: string, revision: number) {
  if (!db.prepare("DELETE FROM content_products WHERE id=? AND revision=?").run(id, revision).changes)
    throw new Error("제품 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.");
}
