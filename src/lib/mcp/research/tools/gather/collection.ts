import { registerTool } from "../../../protocol/tools";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/domains/research/collection/registry";
import * as z from "zod/v4";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations } from "../../shared";
import { criteriaSchema } from "@/domains/research/domain/schema";
import { socialSource } from "@/domains/research/domain/source";

export function registerCollectionTools(server: McpServer, registry: CollectionRegistry) {
  registerTool(server, "list_account_posts", {
    description: "Collect public YouTube community posts without login. Follow docs/research-guidelines.md; do not discover new content topics or visual references. Returns jobId/sessionId; read get_collection_job. Reuse sessionId and nextCursor for pagination. Missing metrics are null; no comment text is collected.",
    inputSchema: z.strictObject({ accountUrl: z.url(), limit: z.number().int().min(1).max(30).default(10),
      criteria: criteriaSchema.optional(), cursor: z.string().max(200).optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => json(registry.start({ source: socialSource(input.accountUrl, "account"),
    kind: "account", limit: input.limit, criteria: input.criteria, cursor: input.cursor }, input.sessionId))));
  registerTool(server, "read_social_post", {
    description: "Collect one public YouTube community post without login: text, ordered media URLs and available like/view/save/comment/share counts. Does not read comment text. Requires the source channelUrl. Returns jobId/sessionId; get_collection_job returns the result. Missing metrics are null; criteriaEvaluation distinguishes failed/unverified/passed. Do not treat popularity as factual evidence.",
    inputSchema: z.strictObject({ url: z.url(), channelUrl: z.url().optional(), criteria: criteriaSchema.optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => {
    const source = socialSource(input.url, "post");
    if (input.channelUrl && socialSource(input.channelUrl, "account").platform !== "youtube") throw new Error("channelUrl must be a YouTube channel URL.");
    return json(registry.start({ source, kind: "post", limit: 1, channelUrl: input.channelUrl, criteria: input.criteria }, input.sessionId));
  }));

}
