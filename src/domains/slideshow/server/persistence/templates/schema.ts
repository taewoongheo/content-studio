export const TEMPLATE_SCHEMA = `
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
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
