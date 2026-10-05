import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
export const json = (data: Record<string, unknown>): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data,
});
export function guarded(operation: () => Promise<CallToolResult> | CallToolResult): Promise<CallToolResult> {
  return Promise.resolve().then(operation).catch((error) => ({
    isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "작업을 처리하지 못했습니다." }],
  }));
}
export const annotations = (readOnlyHint: boolean) => ({ readOnlyHint, destructiveHint: false, openWorldHint: false });

