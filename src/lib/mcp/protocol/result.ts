import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { OperationError } from "@/lib/errors/operation";
export const json = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data,
});
export function guarded(operation: () => Promise<CallToolResult> | CallToolResult): Promise<CallToolResult> {
  return Promise.resolve().then(operation).catch(errorResult);
}
export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "작업을 처리하지 못했습니다.";
  const failure = error instanceof OperationError ? { code: error.code, message, details: error.details, recovery: error.recovery }
    : error instanceof ZodError ? { code: "INVALID_INPUT", message, recovery: "correct_input", details: {
      issues: error.issues.map(issue => ({ ...issue, path: issue.path.map(String) })),
    } }
    : { code: error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "OPERATION_FAILED",
      message, details: {}, recovery: "inspect" };
  return { isError: true, content: [{ type: "text", text: message }], structuredContent: { error: failure } };
}
export const annotations = (readOnlyHint: boolean) => ({ readOnlyHint, destructiveHint: false, openWorldHint: false });
