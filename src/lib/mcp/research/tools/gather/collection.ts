import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import * as z from "zod/v4";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations } from "../../shared";
import { criteriaSchema } from "@/lib/research/domain/schema";
import { socialSource } from "@/lib/research/domain/source";

export function registerCollectionTools(server: McpServer, registry: CollectionRegistry) {
  server.registerTool("list_account_posts", {
    description: "Start a bounded account-post collection using the connected account when available. YouTube collects community posts. Declare your research purpose and follow AGENTS.md and docs/research-guidelines.md, with explicit user instructions taking precedence. For creation without a reference, begin research before selecting a template. Returns jobId/sessionId; use get_collection_job for results. Instagram/TikTok anonymous feeds may be blocked or unavailable. No comments are fetched. Reuse sessionId for cursor pagination. Never assume missing metrics satisfy criteria.",
    inputSchema: z.strictObject({ accountUrl: z.url(), limit: z.number().int().min(1).max(30).default(10),
      criteria: criteriaSchema.optional(), cursor: z.string().max(200).optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => json(registry.start({ source: socialSource(input.accountUrl, "account"),
    kind: "account", limit: input.limit, criteria: input.criteria, cursor: input.cursor }, input.sessionId))));
  server.registerTool("read_social_post", {
    description: "Start collection of one public canonical post URL: text, ordered media URLs and available like/view/save/comment/share counts. Does not read comment text. YouTube requires the source channelUrl. Returns jobId/sessionId; get_collection_job returns the result. Missing metrics are null; criteriaEvaluation distinguishes failed/unverified/passed. Do not treat popularity as factual evidence.",
    inputSchema: z.strictObject({ url: z.url(), channelUrl: z.url().optional(), criteria: criteriaSchema.optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => {
    const source = socialSource(input.url, "post");
    if (input.channelUrl && socialSource(input.channelUrl, "account").platform !== "youtube") throw new Error("channelUrl must be a YouTube channel URL.");
    return json(registry.start({ source, kind: "post", limit: 1, channelUrl: input.channelUrl, criteria: input.criteria }, input.sessionId));
  }));

}
