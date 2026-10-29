import type { Row } from "../../../../domain/contracts";

export const ANALYSIS_INPUTS = "Assigned own-post comparison inputs";
const snapshotFields = ["id", "project_id", "name", "topic", "message", "content_type", "post_url",
  "actual_published_at", "observed_at", "view_count", "like_count", "comment_count", "save_count",
  "share_count", "engagement_rate", "selection_group", "performance"];

/** Keep metadata and metrics, never recursively copy past drafts or their input snapshots. */
export function analysisInputRecord(rows: Row[]) {
  return {
    question: ANALYSIS_INPUTS, source: "Own-post analysis material node",
    finding: JSON.stringify(rows.map(row => Object.fromEntries(snapshotFields.filter(key => key in row).map(key => [key, row[key]])))),
    judgment: "Server-selected inputs shared by this batch. Read each assigned ID before selecting content.",
  };
}
export function readAnalysisInputs(research: Row[]): Row[] | null {
  const record = research.find(row => row.question === ANALYSIS_INPUTS);
  return record ? JSON.parse(String(record.finding)) as Row[] : null;
}
