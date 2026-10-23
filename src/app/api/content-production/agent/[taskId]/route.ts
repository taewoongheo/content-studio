import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isLocalRequest } from "@/lib/http/local-request";
import { createStudioMcpServer } from "@/lib/mcp/server";
import {
  authorizeRun,
  productionStore,
  recordReview,
} from "@/domains/content-production/server/execution/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const readTools = [
  "production_context",
  "production_query",
  "production_comparisons",
  "production_search",
  "production_capture_reference",
  "production_read_images",
  "production_save_draft",
  "list_projects",
  "open_project",
  "read_project",
  "preview_slide",
  "preview_slides",
];
const writeTools = [
  "production_create_project",
  "production_import_image",
  "production_change_direction",
  "edit_project",
  "undo_project",
  "rename_project",
  "set_content_metadata",
];
export async function POST(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const { taskId } = await context.params;
  try {
    authorizeRun(taskId, request.headers.get("authorization"));
  } catch {
    return new Response("Expired run", { status: 403 });
  }
  const run = authorizeRun(taskId, request.headers.get("authorization"));
  const origin = new URL(
    `${new URL(request.url).protocol}//${request.headers.get("host")}`,
  ).origin;
  const server = createStudioMcpServer(
    origin,
    {
      allowed: new Set([
        ...readTools,
        ...(run.step === "production" ? writeTools : []),
      ]),
      before(name, input) {
        authorizeRun(taskId, request.headers.get("authorization"));
        if (writeTools.includes(name) && !name.startsWith("production_")) {
          const projectId = (input as { projectId?: string }).projectId;
          if (projectId !== productionStore().get(taskId).task.project_id)
            throw new Error("이 작업에 연결된 프로젝트만 수정할 수 있습니다.");
        }
      },
      after(name, input, result) {
        if (
          result.isError ||
          !(name === "preview_slide" || name === "preview_slides")
        )
          return;
        for (const item of result.content ?? []) {
          if (item.type !== "text") continue;
          try {
            const meta = JSON.parse(item.text);
            if (meta.projectId && typeof meta.revision === "number")
              recordReview(
                taskId,
                meta.projectId,
                meta.revision,
                meta.slideIds ?? [meta.slideId],
              );
          } catch {}
        }
        void input;
      },
    },
    taskId,
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
