import { ensureReferenceImages } from "@/domains/content-production/server/references/spy/images";
import { saveReferenceContext } from "@/domains/content-production/server/references/context";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { REFERENCE_LIMIT } from "@/domains/content-production/domain/references/context";
import { contentMetadataSchema } from "@/domains/content-metadata/schema";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore } from "@/domains/content-production/server/execution/runner";
import { queryStageReferences } from "@/domains/content-production/server/references/selection";
import { describeReference } from "@/domains/content-production/server/references/library";
import { getReferenceContext } from "@/domains/content-production/server/references/context";

export function registerExternalReferenceTools(server: McpServer, taskId: string) {
  registerTool(server,"production_external_references",{
    description: "Read external references from the database only. Analysis returns the batch's fixed sample: five random performance candidates plus five recent posts. Production and hook search the entire saved library for relevant topic/message/format, up to five distinct posts per stage. Use short literal keywords or IDs. No account collection or external discovery is available. Use production_reference_images for a selected post only when its actual slides are needed; then production_read_images with the returned set_id. Captions alone cannot establish visual features.",
    inputSchema:z.object({query:z.string().default(""),content_type:z.string().default(""),ids:z.array(z.string()).max(REFERENCE_LIMIT).optional()}),annotations:annotations(false),
  },input=>guarded(async()=>{
    const store=productionStore(),step=store.get(taskId).task.current_step;
    return json({...await queryStageReferences(store.db,taskId,step,{...input,collect:false})});
  }));
  registerTool(server,"production_reference_images",{
    description:"Ensure actual slideshow images for an already selected database reference. Downloads only this post when needed and reuses stored images. Returns set_id for production_read_images. Video-only posts have no slideshow images.",
    inputSchema:z.object({id:z.string().min(1)}),annotations:annotations(false),
  },input=>guarded(async()=>{
    const store=productionStore(),step=store.get(taskId).task.current_step;
    const context=getReferenceContext(store.db,taskId,step);
    if (!context?.posts.some(post=>post.id===input.id)) throw new Error("이번 단계에서 조회한 레퍼런스만 이미지를 확보할 수 있습니다.");
    store.assertActive(taskId,step);
    const set=await ensureReferenceImages(store.db,input.id);
    store.assertActive(taskId,step);
    const latest=getReferenceContext(store.db,taskId,step)!;
    latest.posts=latest.posts.map(post=>post.id===input.id?{...post,visual_set_id:set}:post);
    saveReferenceContext(store.db,taskId,step,latest);
    return json({set_id:set});
  }));
  registerTool(server,"production_describe_reference",{
    description:"After inspecting a selected external post's actual slides, save English title plus topic, message and content_type following docs/content-metadata.md. Describe the actual answer and broad information/visual structure; concrete styles remain in slide images. This makes future contextual lookup useful; it is descriptive metadata, not a quality endorsement. Only selected examples for this stage can be described.",
    inputSchema:contentMetadataSchema.extend({id:z.string(),title:z.string().min(1)}),annotations:annotations(false),
  },input=>guarded(()=>{
    const store=productionStore(),step=store.get(taskId).task.current_step;
    const context=getReferenceContext(store.db,taskId,step);
    if(!context?.posts.some(post=>post.id===input.id))throw new Error("이번 단계에서 조회한 레퍼런스만 설명할 수 있습니다.");
    const {id,...description}=input;describeReference(store.db,id,description);return json({saved:true});
  }));
}
