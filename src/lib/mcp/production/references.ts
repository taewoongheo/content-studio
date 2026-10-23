import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore } from "@/domains/content-production/server/execution/runner";
import { queryStageReferences } from "@/domains/content-production/server/references/selection";
import { describeReference } from "@/domains/content-production/server/references/library";
import { getReferenceContext } from "@/domains/content-production/server/references/context";

export function registerExternalReferenceTools(server: McpServer, taskId: string) {
  registerTool(server,"production_external_references",{
    description: "Compare external examples from the shared library. Mandatory once before analysis completes; optional for hook/visual. Each of analysis/hook/visual may see at most THREE distinct external posts across all calls and retries. Use short literal query keywords (or empty for broad exploration), content_type or chosen ids before spending slots. Unknown content_type is eligible so you can inspect and describe it. collect=true, only when the stored pool is insufficient, permits ONE designated-account collection per stage (up to 12 candidate posts); concurrent instances share recent account collections. Collection is separate from the three-post reference allowance. Excluded posts never reappear. Production only reuses analysis examples and cannot collect. Inspect actual stored images and explain application or justified non-use; collection does not establish quality. Query does not force a new topic.",
    inputSchema:z.object({query:z.string().default(""),content_type:z.string().default(""),collect:z.boolean().default(false),ids:z.array(z.string()).max(3).optional()}),annotations:annotations(false),
  },input=>guarded(async()=>{
    const store=productionStore(),step=store.get(taskId).task.current_step;
    return json({...await queryStageReferences(store.db,taskId,step,input)});
  }));
  registerTool(server,"production_describe_reference",{
    description:"After inspecting a selected external post's actual slides, save English title, topic, content_type and notes about its hook/body/visual features. This makes future contextual lookup useful; it is descriptive metadata, not a quality endorsement. Only selected examples for this stage can be described.",
    inputSchema:z.object({id:z.string(),title:z.string().min(1),topic:z.string().min(1),content_type:z.string().min(1),notes:z.string().min(1)}),annotations:annotations(false),
  },input=>guarded(()=>{
    const store=productionStore(),step=store.get(taskId).task.current_step;
    const context=getReferenceContext(store.db,taskId,step === "production" ? "analysis" : step);
    if(!context?.posts.some(post=>post.id===input.id))throw new Error("이번 단계에서 조회한 레퍼런스만 설명할 수 있습니다.");
    const {id,...description}=input;describeReference(store.db,id,description);return json({saved:true});
  }));
}
