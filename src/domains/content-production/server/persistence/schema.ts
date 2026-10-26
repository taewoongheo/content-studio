import { reviewSteps } from "../../domain/contracts";

const direction = `topic TEXT, content_type TEXT, message TEXT, answer TEXT, presentation TEXT,
  reason TEXT, expected_response TEXT, goal_connection TEXT, difference_from_recent TEXT`;
const progress = `research_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(research_json)),
  sources_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(sources_json)),
  completed_actions_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(completed_actions_json)),
  remaining_actions_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(remaining_actions_json)), error_json TEXT CHECK(error_json IS NULL OR json_valid(error_json))`;
export const PRODUCTION_SCHEMA = `
CREATE TABLE IF NOT EXISTS content_creation_logs (
 id TEXT PRIMARY KEY, project_id TEXT UNIQUE REFERENCES content_projects(id) ON DELETE SET NULL,
 analysis TEXT, ${direction}, sources_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(sources_json)),
 content_summary_json TEXT CHECK(content_summary_json IS NULL OR json_valid(content_summary_json)),
 platform TEXT, post_url TEXT UNIQUE, actual_published_at TEXT, view_count INTEGER, like_count INTEGER,
 comment_count INTEGER, save_count INTEGER, share_count INTEGER, observed_at TEXT, completed_at TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_logs_published_idx ON content_creation_logs(actual_published_at);
CREATE INDEX IF NOT EXISTS content_logs_created_idx ON content_creation_logs(created_at);
CREATE TABLE IF NOT EXISTS content_drafts (
 id TEXT PRIMARY KEY, log_id TEXT UNIQUE NOT NULL REFERENCES content_creation_logs(id),
 project_id TEXT UNIQUE REFERENCES content_projects(id) ON DELETE SET NULL,
 current_step TEXT NOT NULL CHECK(current_step IN ('analysis','production','hook','visual','polish')),
 state TEXT NOT NULL CHECK(state IN ('pending','running','stopped','failed','finished')),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_analysis_drafts (
 draft_id TEXT PRIMARY KEY REFERENCES content_drafts(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending', analysis TEXT, ${direction}, ${progress},
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS content_production_drafts (
 draft_id TEXT PRIMARY KEY REFERENCES content_drafts(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending', content_json TEXT CHECK(content_json IS NULL OR json_valid(content_json)),
 direction_changes TEXT, draft_saved_at TEXT, ${progress},
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);
${reviewSteps.map(step => `CREATE TABLE IF NOT EXISTS content_${step}_drafts (
 draft_id TEXT PRIMARY KEY REFERENCES content_drafts(id) ON DELETE CASCADE,
 state TEXT NOT NULL DEFAULT 'pending', review TEXT, content_json TEXT CHECK(content_json IS NULL OR json_valid(content_json)),
 ${progress}, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
);
`).join("\n")}
CREATE TABLE IF NOT EXISTS content_visual_sets (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('reference','published')),
 log_id TEXT UNIQUE REFERENCES content_creation_logs(id) ON DELETE CASCADE, source_url TEXT NOT NULL,
 slide_count INTEGER NOT NULL CHECK(slide_count>0), captured_at TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(kind,source_url)
);
CREATE TABLE IF NOT EXISTS content_visual_slides (
 set_id TEXT NOT NULL REFERENCES content_visual_sets(id) ON DELETE CASCADE,
 slide_index INTEGER NOT NULL CHECK(slide_index>=0), mime_type TEXT NOT NULL DEFAULT 'image/webp',
 width INTEGER NOT NULL, height INTEGER NOT NULL, byte_size INTEGER NOT NULL, data BLOB NOT NULL,
 PRIMARY KEY(set_id,slide_index)
);
CREATE TABLE IF NOT EXISTS content_reference_accounts (
 username TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 last_fetched_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_external_references (
 id TEXT PRIMARY KEY, url TEXT NOT NULL UNIQUE, account TEXT NOT NULL, caption TEXT NOT NULL,
 title TEXT NOT NULL DEFAULT '', topic TEXT NOT NULL DEFAULT '', content_type TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
 published_at TEXT, observed_at TEXT NOT NULL, view_count INTEGER, like_count INTEGER, comment_count INTEGER, save_count INTEGER, share_count INTEGER,
 images_json TEXT NOT NULL CHECK(json_valid(images_json)), visual_set_id TEXT REFERENCES content_visual_sets(id), image_error TEXT,
 excluded INTEGER NOT NULL DEFAULT 0 CHECK(excluded IN (0,1)), created_at TEXT NOT NULL, last_selected_at TEXT
);
CREATE INDEX IF NOT EXISTS external_references_account_idx ON content_external_references(account);
`;
