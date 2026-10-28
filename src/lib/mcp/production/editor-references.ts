import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getLocalDatabase } from "@/lib/local-db/database";
import { externalReferences } from "@/domains/content-production/server/references/library";
import { ensureReferenceImages } from "@/domains/content-production/server/references/spy/images";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";

/** Editor sessions reuse the saved library without requiring a running production draft. */
export function registerEditorReferences(server: McpServer) {
  registerTool(server, "production_external_references", {
    description: "Search saved external reference posts by literal topic/message/caption keywords or IDs. Returns at most 10 posts. Use production_reference_images only when actual slides are needed, then production_read_images with its set_id.",
    inputSchema: z.object({ query: z.string().default(""), content_type: z.string().default(""), ids: z.array(z.string()).max(10).optional() }),
    annotations: annotations(true),
  }, input => guarded(() => json({ posts: externalReferences(getLocalDatabase(), input.query, input.content_type)
    .filter(post => !input.ids || input.ids.includes(String(post.id))).slice(0, 10) })));
  registerTool(server, "production_reference_images", {
    description: "Retrieve actual slideshow images for one saved external reference; reuse cached images or download this post only. Returns set_id for production_read_images. Video-only posts have no slideshow images.",
    inputSchema: z.object({ id: z.string().min(1) }), annotations: annotations(false),
  }, input => guarded(async () => {
    const db = getLocalDatabase();
    if (!externalReferences(db).some(post => post.id === input.id)) throw new Error("사용 가능한 외부 레퍼런스가 아닙니다.");
    return json({ set_id: await ensureReferenceImages(db, input.id) });
  }));
}
