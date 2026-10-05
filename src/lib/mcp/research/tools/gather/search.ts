import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import type { AccountManager } from "@/lib/research/accounts/manager";
import { searchInputSchema, searchUrl } from "@/lib/research/search/types";
import { criteriaSchema } from "@/lib/research/domain/schema";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations } from "../../shared";
export function registerSearchTools(server: McpServer, registry: CollectionRegistry, accounts: AccountManager) {
  server.registerTool("search_social_candidates", {
    description: "Search INSIDE TikTok, Instagram or YouTube by keyword for accounts or posts. No external web search. TikTok and Instagram require an account connected in Dashboard → Settings; login_required and account status are returned in get_collection_job when reconnection is needed. One native result page, max 30 results, no comments and no automatic repeated search. Posts are candidates: inspect text/images and criteriaEvaluation. YouTube posts search returns videos, not community posts; discover channels then use list_account_posts for community content. Returns jobId/sessionId; use get_collection_job and close_collection_session.",
    inputSchema: searchInputSchema.extend({ criteria: criteriaSchema.optional() }), annotations: researchAnnotations,
  }, input => guarded(() => json(registry.start({ source: { platform: input.platform, id: input.query, url: searchUrl(input) },
    kind: "search", search: { platform: input.platform, query: input.query, type: input.type, limit: input.limit }, limit: input.limit, criteria: input.criteria }))));
  server.registerTool("get_research_accounts", {
    description: "Read redacted TikTok/Instagram connection status shared with Dashboard → Settings. No passwords/cookies/tokens. disconnected/login_required means ask the user to connect or reconnect through the dashboard. Does not open a browser or renew authentication.",
    inputSchema: z.strictObject({}), annotations: { ...researchAnnotations, readOnlyHint: true },
  }, () => guarded(() => json({ accounts: accounts.list(), manageIn: "Dashboard → Settings → Research accounts" })));
}
