import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolAttempt } from "../../../domain/diagnostics";

const inputKeys = ["projectId", "set_id", "slideIds", "indexes", "query", "keywords", "content_type", "collect", "ids", "outline", "width"];
export function beginToolCall(callId: string, name: string, input: unknown): ToolAttempt {
  const args = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return { call_id: callId, tool: name, started_at: new Date().toISOString(), status: "pending",
    input: Object.fromEntries(inputKeys.filter(key => key in args).map(key => [key, args[key]])) };
}
export function finishToolCall(attempt: ToolAttempt, result: CallToolResult) {
  attempt.finished_at = new Date().toISOString();
  const items = result.structuredContent?.items;
  if (Array.isArray(items)) {
    const rows = items.filter(item => item && typeof item === "object") as Array<{id?:string;project_id?:string}>;
    attempt.output = { count: rows.length, ids: rows.flatMap(row => row.id ? [row.id] : []), project_ids: rows.flatMap(row => row.project_id ? [row.project_id] : []) };
  }
  const error = result.structuredContent?.error as {code?:string;message?:string} | undefined;
  attempt.status = result.isError ? "failed" : "succeeded";
  if (result.isError) {
    attempt.code = error?.code ?? "TOOL_CALL_FAILED";
    attempt.message = (error?.message ?? result.content.filter(item => item.type === "text").map(item => item.text).join("\n")).slice(0, 3000);
  } else if (["production_read_images", "production_preview_project", "preview_slides", "preview_slide"].includes(attempt.tool)
      && !result.content.some(item => item.type === "image")) attempt.status = "empty";
}
