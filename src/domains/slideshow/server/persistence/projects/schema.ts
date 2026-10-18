import type Database from "better-sqlite3";

export const PROJECT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    slide_count INTEGER NOT NULL CHECK (slide_count > 0),
    output_language TEXT NOT NULL,
    document_json TEXT NOT NULL,
    template_id TEXT REFERENCES content_templates(id) ON DELETE RESTRICT,
    topic TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS content_templates (
    id TEXT PRIMARY KEY,
    aspect_ratio TEXT NOT NULL,
    slide_count INTEGER NOT NULL CHECK (slide_count > 0),
    output_language TEXT NOT NULL,
    document_json TEXT NOT NULL,
    name TEXT NOT NULL,
    topic TEXT NOT NULL,
    message TEXT NOT NULL,
    composition TEXT NOT NULL,
    loop_order INTEGER CHECK (loop_order > 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS content_templates_loop_order_idx ON content_templates(loop_order);
  CREATE INDEX IF NOT EXISTS content_projects_published_at_idx ON content_projects(published_at DESC);
  CREATE INDEX IF NOT EXISTS content_projects_template_idx ON content_projects(template_id);
  CREATE INDEX IF NOT EXISTS content_projects_updated_at_idx ON content_projects(updated_at DESC);
  CREATE TABLE IF NOT EXISTS content_project_assets (
    project_id TEXT NOT NULL REFERENCES content_projects(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    data BLOB NOT NULL,
    PRIMARY KEY (project_id, asset_id)
  );
  CREATE TABLE IF NOT EXISTS content_template_assets (
    template_id TEXT NOT NULL REFERENCES content_templates(id) ON DELETE CASCADE,
    asset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    byte_size INTEGER NOT NULL CHECK (byte_size > 0),
    data BLOB NOT NULL,
    PRIMARY KEY (template_id, asset_id)
  );
`;

export function ensureProjectSchema(database: Database.Database) {
  database.transaction(() => database.exec(PROJECT_SCHEMA))();
}
