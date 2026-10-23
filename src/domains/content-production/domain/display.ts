import type { Row } from "./contracts";

export type DisplayScope = "detail" | "canvas";
export const displayFields = [
  "analysis", "topic", "content_type", "message", "answer", "presentation",
  "reason", "expected_response", "goal_connection", "difference_from_recent",
  "research", "sources", "content", "completed_actions", "remaining_actions",
  "direction_changes", "review",
] as const;
function short(value: unknown) {
  if (typeof value !== "string" || value.length <= 400) return value;
  return value.slice(0, 400).replace(/\s+\S*$/, "") + "…";
}
export function displayContent(context: Row, scope: DisplayScope = "detail"): Row {
  if (scope === "detail")
    return Object.fromEntries(displayFields.filter(key => context[key] != null).map(key => [key, context[key]]));
  const result = Object.fromEntries(["topic", "content_type", "message", "answer", "review"]
    .filter(key => typeof context[key] === "string" && context[key]).map(key => [key, short(context[key])]));
  const content = context.content as Row | undefined;
  if (typeof content?.hook === "string" && content.hook) result.content = { hook: content.hook };
  return result;
}
export function displayContentKey(context: Row | null | undefined, scope: DisplayScope = "detail"): string {
  return context ? JSON.stringify(displayContent(context, scope)) : "";
}
export function applyCanvasTranslation(context: Row, translated: Row): Row {
  return { ...context, ...translated, ...(translated.content ? { content: { ...(context.content as Row), ...(translated.content as Row) } } : {}) };
}
