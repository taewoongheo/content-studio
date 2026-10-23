import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore } from "@/domains/content-production/server/execution/runner";
import { captureSourceProject } from "@/domains/content-production/server/sources";
import { inspectSlideshow } from "@/domains/slideshow/projects/inspection/read";
import { previewSlides } from "@/domains/slideshow/server/rendering/preview";

export function registerSourceTools(server: McpServer, origin: string) {
  const source = z.object({ projectId: z.string().min(1), slideIds: z.array(z.string().min(1)).min(1).max(20).optional() });
  registerTool(server, "production_read_project", {
    description: "Read the SAVED document, content and asset metadata of a published post directly from the DB. Does not open an editor, create a tab or read unsaved changes. Use outline=true for text/IDs; production_preview_project shows saved slides.",
    inputSchema: source.extend({ outline: z.boolean().default(false) }), annotations: annotations(true),
  }, input => guarded(() => {
    const {job} = captureSourceProject(productionStore(),input.projectId,input.slideIds);
    const view = inspectSlideshow(job,{slideIds:input.slideIds,outline:input.outline});
    return json({ projectId:job.id,name:job.name,updatedAt:job.updatedAt,source:"saved",assets:job.assets,
      ...(input.outline ? {slides:"slides" in view ? view.slides : []} : {document:"editor" in view ? view.editor.document : undefined}) });
  }));
  registerTool(server, "production_preview_project", {
    description: "See SAVED source slides without opening any editor tabs. Only published posts. Omit slideIds for all slides. Uses the existing slideshow renderer and DB images. Does not count as the final review of the content being produced.",
    inputSchema: source.extend({width:z.number().int().min(64).max(1920).default(540)}), annotations: annotations(true),
  }, input => guarded(async () => {
    const captured=captureSourceProject(productionStore(),input.projectId,input.slideIds);
    const ids=input.slideIds ?? captured.job.editor.document.slides.map(slide=>slide.id);
    const results=await previewSlides(origin,captured.job,ids,{width:input.width,images:captured.images});
    return {content:[{type:"text" as const,text:JSON.stringify({projectId:input.projectId,source:"saved",slideIds:ids})},
      ...results.flatMap(result=>[{type:"text" as const,text:result.slideId},{type:"image" as const,mimeType:"image/png",data:result.bytes.toString("base64")}])]};
  }));
}
