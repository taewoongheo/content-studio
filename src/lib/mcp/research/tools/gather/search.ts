import { registerTool } from "../../../protocol/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/domains/research/collection/registry";
import { searchInputSchema, searchUrl } from "@/domains/research/search/types";
import { criteriaSchema } from "@/domains/research/domain/schema";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations } from "../../shared";
export function registerSearchTools(server: McpServer, registry: CollectionRegistry) {
  registerTool(server, "search_social_candidates", {
    description: "Search public YouTube channels or videos without login. YouTube posts search returns videos; discover channels then use list_account_posts for community posts. This general YouTube tool is not available to production agents. Do not use it to discover new content topics or visual references. Returns jobId/sessionId; read get_collection_job and close_collection_session when done.",
    inputSchema: searchInputSchema.extend({ criteria: criteriaSchema.optional() }), annotations: researchAnnotations,
  }, input => guarded(() => json(registry.start({ source: { platform: input.platform, id: input.query, url: searchUrl(input) },
    kind: "search", search: { platform: input.platform, query: input.query, type: input.type, limit: input.limit }, limit: input.limit, criteria: input.criteria }))));
}
