import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createStudioMcpServer } from "@/lib/mcp/server";
import { isLocalRequest } from "@/lib/http/local-request";
import { authorizeAssistant } from "@/domains/workspace/assistant/server/service";
import { registerEditorReferences } from "@/lib/mcp/production/editor-references";
const referenceTools = ["production_query", "production_read_project", "production_preview_project", "production_read_images",
  "production_external_references", "production_reference_images",
  "search_social_candidates", "read_social_post", "read_post_images", "get_collection_job"];
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ tabId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const { tabId } = await context.params;
  const auth = request.headers.get("authorization");
  try {
    const run = authorizeAssistant(tabId, auth);
    const reads = run.target.projectType === "video" ? ["read_video_project", "preview_video"] : ["read_project", "preview_slide", "preview_slides"];
    const write = run.target.projectType === "video" ? "edit_video_project" : "edit_project";
    const server = createStudioMcpServer(new URL(request.url).origin, {
      allowed: new Set([...referenceTools, ...reads, ...(run.phase === "edit" ? [write] : [])]),
      before(name, input) {
        const active = authorizeAssistant(tabId, auth);
        if (active !== run) throw new Error("이전 실행은 종료됐습니다.");
        if (reads.includes(name) || name === write) {
          const data = input as { projectId?: string; expectedTabId?: string };
          if (data.projectId !== run.target.projectId || (name === write && data.expectedTabId !== tabId))
            throw new Error("현재 에디터 탭만 조회·수정할 수 있습니다.");
        }
        if (name === write && run.phase !== "edit") throw new Error("질문에서는 수정할 수 없습니다.");
      },
      after(name, _input, result) {
        if (result.isError) return;
        if (name === write) { run.changed = true; run.slides.clear(); run.reviewedRevision = undefined; }
        if (!["preview_slide", "preview_slides", "preview_video"].includes(name)) return;
        for (const item of result.content) if (item.type === "text") {
          try {
            const data = JSON.parse(item.text);
            if (data.projectId !== run.target.projectId || typeof data.revision !== "number" || data.region) continue;
            if (run.reviewedRevision !== data.revision) run.slides.clear();
            run.reviewedRevision = data.revision;
            for (const id of data.slideIds ?? (data.slideId ? [data.slideId] : [])) run.slides.add(id);
          } catch { /* Slide labels are plain text. */ }
        }
      },
    }, undefined, () => { authorizeAssistant(tabId, auth); }, run.id, () => { authorizeAssistant(tabId, auth); });
    registerEditorReferences(server);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      return await transport.handleRequest(request);
    } finally { await server.close(); }

  } catch { return new Response("Expired editor assistant run", { status: 403 }); }
}
