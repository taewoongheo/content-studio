import type Database from "better-sqlite3";

export const REUSE_GUIDE_COLUMNS = [
  "reuse_content_role", "reuse_reader_outcome", "reuse_required_information", "reuse_selection_criteria",
] as const;

/** Preserve legacy prose for review instead of inferring missing semantic fields. */
export function migrateReuseGuide(database: Database.Database) {
  const columns = database.prepare("PRAGMA table_info(content_projects)").all() as Array<{ name: string }>;
  const existing = new Set(columns.map(column => column.name));
  for (const column of REUSE_GUIDE_COLUMNS) {
    if (!existing.has(column)) database.exec(`ALTER TABLE content_projects ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
  if (existing.has("reuse_guide")) {
    database.exec(`UPDATE content_projects SET reuse_content_role = reuse_guide
      WHERE reuse_content_role = '' AND reuse_guide <> ''`);
    database.exec("ALTER TABLE content_projects DROP COLUMN reuse_guide");
  }
  if (!existing.has("is_template"))
    database.exec("ALTER TABLE content_projects ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0 CHECK (is_template IN (0, 1))");
}
