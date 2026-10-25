import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore, visualReferenceProjects } from "@/domains/content-production/server/execution/runner";
import { readVisualReferences, readSelectedVisualReferences } from "@/domains/content-production/server/persistence/planning/visual";

export function registerVisualReferenceTool(server: McpServer, taskId: string) {
  registerTool(server,"production_visual_references",{
    description:"Visual stage only. Find up to FIVE most recently published OWN posts whose title/topic/message contains any supplied subject keyword. Use specific subject phrases and synonyms (for example add weight or double progression), not broad words like workout, weight, or reps alone. Text search precedes image inspection; it is not semantic image search. Once a nonempty set is selected, it remains fixed for this execution. If no matches, refine keywords and retry; never claim nonexistent references. Read actual images of the selected project ids with production_preview_project. No external examples or engagement ranking in visual review.",
    inputSchema:z.object({keywords:z.array(z.string().trim().min(1)).min(1).max(5)}),annotations:annotations(true),
  },input=>guarded(()=>{
    const store=productionStore();
    const previous=visualReferenceProjects(taskId);
    if(previous?.length) return json({items:readSelectedVisualReferences(store.db, previous),selection:"recent_matching",limit:5});
    const items=readVisualReferences(store.db,input.keywords);
    visualReferenceProjects(taskId,items.map(item=>String(item.project_id)));
    return json({items,selection:"recent_matching",keywords:input.keywords,limit:5});
  }));
}
