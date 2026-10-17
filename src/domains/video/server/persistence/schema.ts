export const VIDEO_SCHEMA = `
CREATE TABLE IF NOT EXISTS video_projects (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, document_json TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS video_project_assets (
 project_id TEXT NOT NULL REFERENCES video_projects(id) ON DELETE CASCADE,
 id TEXT NOT NULL, name TEXT NOT NULL, mime_type TEXT NOT NULL, data BLOB NOT NULL,
 PRIMARY KEY(project_id, id)
);`;
