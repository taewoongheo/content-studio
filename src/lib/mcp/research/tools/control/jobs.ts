import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations, jobSchema } from "../../shared";


export function registerJobsTools(server: McpServer, registry: CollectionRegistry) {
  server.registerTool("get_collection_job", {
    description: "Read an in-memory collection job and results across MCP requests. A running job needs another check later. Block reasons distinguish visible captcha_required, login_required, rate_limited, access_denied, empty_response, unsupported and setup_required. HTTP 401/403 alone never means CAPTCHA. Results expire after 30 minutes of inactivity or session close/server restart.",
    inputSchema: jobSchema, annotations: { ...annotations, readOnlyHint: true },
  }, ({ jobId }) => guarded(() => json(registry.snapshot(jobId))));

}
