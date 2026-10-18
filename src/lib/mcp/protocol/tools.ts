import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema, type CallToolResult, type ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { OperationError } from "@/lib/errors/operation";
import { guarded } from "./result";

type Tool = { parse: (input: unknown) => Promise<unknown>; call: (input: unknown) => CallToolResult | Promise<CallToolResult> };
const registries = new WeakMap<McpServer, Map<string, Tool>>();

/** Keep SDK discovery schemas; validate at the protocol boundary so schema failures are structured too. */
export function registerTool<S extends z.ZodType>(server: McpServer, name: string,
  config: { description: string; inputSchema: S; annotations?: ToolAnnotations },
  handler: (input: z.output<S>) => CallToolResult | Promise<CallToolResult>) {
  server.registerTool(name, { ...config, inputSchema: config.inputSchema as z.ZodType }, input => handler(input as z.output<S>));
  const tools = registries.get(server) ?? new Map<string, Tool>();
  registries.set(server, tools);
  tools.set(name, { parse: input => config.inputSchema.parseAsync(input), call: input => handler(input as z.output<S>) });
  server.server.setRequestHandler(CallToolRequestSchema, (request) => guarded(async () => {
    const tool = tools.get(request.params.name);
    if (!tool) throw new OperationError("TOOL_NOT_FOUND", "제공되지 않는 도구입니다.", { tool: request.params.name });
    if (request.params.task) throw new OperationError("UNSUPPORTED_TASK", "이 도구는 MCP task 요청을 지원하지 않습니다.");
    return tool.call(await tool.parse(request.params.arguments ?? {}));
  }));
}
