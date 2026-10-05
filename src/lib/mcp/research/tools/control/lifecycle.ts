import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import * as z from "zod/v4";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations, jobSchema } from "../../shared";


export function registerLifecycleTools(server: McpServer, registry: CollectionRegistry) {
  server.registerTool("resume_collection", {
    description: "Retry a blocked collection in the retained session after addressing its actual block reason. Max three attempts per job. A successful data response confirms recovery; solving a visual challenge alone does not. No automatic retry loop or required research workflow is imposed.",
    inputSchema: jobSchema, annotations,
  }, ({ jobId }) => guarded(() => json(registry.resume(jobId))));
  server.registerTool("close_collection_session", {
    description: "Cancel jobs, close only this research session's dedicated browser and discard its temporary in-memory results/cursors. Idempotent. Does not close Content Studio projects or the user's browser. Use after finishing research.",
    inputSchema: z.strictObject({ sessionId: z.uuid() }), annotations,
  }, ({ sessionId }) => guarded(async () => json(await registry.close(sessionId))));
}
