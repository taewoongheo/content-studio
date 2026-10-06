import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import * as z from "zod/v4";
import { guarded } from "../../../protocol/result";
import { researchAnnotations as annotations } from "../../shared";
import { readSourceImage } from "@/lib/research/media/images";

export function registerImagesTools(server: McpServer, registry: CollectionRegistry) {
  server.registerTool("read_post_images", {
    description: "Inspect selected source slideshow images from a completed collection, without creating/editing a project. Pass jobId and a postId from its result. imageIndexes are zero-based indexes into the post's ordered media array; select up to three images per call to bound output. Media URLs can expire; recollect when needed. No OCR or factual verification is implied.",
    inputSchema: z.strictObject({ jobId: z.uuid(), postId: z.string().max(200), imageIndexes: z.array(z.number().int().min(0).max(100)).min(1).max(3).default([0]) }),
    annotations: { ...annotations, readOnlyHint: true },
  }, input => guarded(async () => {
    const post = registry.getPost(input.jobId, input.postId);
    const indexes = [...new Set(input.imageIndexes)];
    const content = [];
    for (const index of indexes) {
      const media = post.media[index];
      if (!media || media.type !== "image") throw new Error(`Media index ${index} is not an image in this post.`);
      content.push({ type: "text" as const, text: JSON.stringify({ postId: post.id, imageIndex: index, sourceUrl: post.url }) });
      content.push(await readSourceImage(media.url));
    }
    return { content };
  }));

}
