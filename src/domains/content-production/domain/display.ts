import type { Row } from "./contracts";

export const displayFields = [
  "analysis", "topic", "content_type", "message", "answer", "presentation",
  "reason", "expected_response", "goal_connection", "difference_from_recent",
  "research", "sources", "content", "completed_actions", "remaining_actions",
  "direction_changes",
] as const;

export function displayContent(context: Row): Row {
  return Object.fromEntries(displayFields.filter(key => context[key] != null).map(key => [key, context[key]]));
}
