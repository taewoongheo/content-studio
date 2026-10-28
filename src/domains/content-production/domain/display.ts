import type { Row } from "./contracts";

export const displayFields = [
  "analysis", "reasoning", "slide_plan", "content_review", "topic", "content_type", "message", "answer", "presentation",
  "reason", "expected_response", "goal_connection", "difference_from_recent",
  "research", "sources", "content", "completed_actions", "remaining_actions",
  "direction_changes", "review",
] as const;
export function displayContent(context: Row): Row {
  return Object.fromEntries(displayFields.filter(key => context[key] != null).map(key => [key, context[key]]));
}
export function displayContentKey(context: Row | null | undefined): string {
  return context ? JSON.stringify(displayContent(context)) : "";
}
