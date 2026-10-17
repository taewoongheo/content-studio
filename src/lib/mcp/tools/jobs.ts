import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { renderJobs } from "@/domains/workspace/server/jobs/manager";
import { annotations, guarded, json } from "../protocol/result";
export function registerRenderJobTools(server: McpServer) {
  const schema = z.strictObject({ jobId: z.string().uuid() });
  server.registerTool("get_render_job", {
    description: "Poll a video MP4 or slideshow ZIP export started asynchronously. Returns queued/running/cancelling/completed/failed/cancelled, progress 0-1, phase, captured project revision, and final outputPath/bytes or error. Poll at intervals of 1-2 seconds. Completed metadata expires after 15 minutes; server restart clears jobs. Does not include media bytes.",
    inputSchema: schema, annotations: annotations(true),
  }, ({ jobId }) => guarded(() => json(renderJobs.get(jobId))));
  server.registerTool("cancel_render_job", {
    description: "Cancel a queued or running export. Poll until cancelled/completed/failed; cancellation cleans partial outputs and preserves an existing destination file. Already completed exports stay completed and their files are retained.",
    inputSchema: schema, annotations: annotations(false),
  }, ({ jobId }) => guarded(() => json(renderJobs.cancel(jobId))));
}
