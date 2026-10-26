import { registerTool } from "../../../protocol/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/domains/research/collection/registry";
import * as z from "zod/v4";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations, jobSchema } from "../../shared";


export function registerLifecycleTools(server: McpServer, registry: CollectionRegistry) {
  registerTool(server, "resume_collection", {
    description: "Retry a blocked collection in the retained session after addressing its failure. Max three attempts per job. No automatic retry loop or required research workflow is imposed.",
    inputSchema: jobSchema, annotations,
  }, ({ jobId }) => guarded(() => json(registry.resume(jobId))));
  registerTool(server, "close_collection_session", {
    description: "Cancel this YouTube research session and discard its temporary results and cursors. Idempotent. Does not close Content Studio projects. Use after finishing research.",
    inputSchema: z.strictObject({ sessionId: z.uuid() }), annotations,
  }, ({ sessionId }) => guarded(async () => json(await registry.close(sessionId))));
}
