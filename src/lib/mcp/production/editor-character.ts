import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded } from "../protocol/result";

export function registerEditorCharacter(server: McpServer) {
  registerTool(server, "assistant_character_references", {
    description: "Read the two official character identity images only when generating or checking character artwork. Returns actual images plus local paths to pass to image generation. Not needed for text edits or copywriting.",
    inputSchema: z.object({}), annotations: annotations(true),
  }, () => guarded(async () => {
    const paths = ["turnaround.png", "face-sunglasses.png"].map(name => join(process.cwd(), "docs/production-prompts/character", name));
    const images = await Promise.all(paths.map(path => readFile(path)));
    return { content: [{ type: "text" as const, text: JSON.stringify({ paths }) },
      ...images.map(bytes => ({ type: "image" as const, mimeType: "image/png", data: bytes.toString("base64") }))] };
  }));
}
