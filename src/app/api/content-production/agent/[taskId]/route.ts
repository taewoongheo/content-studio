import { assertUniqueProjectImages } from "@/domains/content-production/server/images/unique";
import { stagePolicy, editorReadTools, editorWriteTools as writeTools } from "@/domains/content-production/server/execution/policy/stages";
import { REFERENCE_LIMIT } from "@/domains/content-production/domain/references/context";
import { OperationError } from "@/lib/errors/operation";
import { referenceImagesAllowed } from "@/domains/content-production/server/references/selection";
import { assertReviewWrite } from "@/domains/content-production/server/execution/review/write-policy";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isLocalRequest } from "@/lib/http/local-request";
import { createStudioMcpServer } from "@/lib/mcp/server";
import {
  authorizeRun,
  productionStore,
  recordReview,
  recordToolCall,
  recordAnalysisRead,
  recordExternalComparison,
  recordSourceReview,
} from "@/domains/content-production/server/execution/runner";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
  const step = run.step;
  const origin = new URL(
    `${new URL(request.url).protocol}//${request.headers.get("host")}`,
  ).origin;
  const server = createStudioMcpServer(
    origin,
    {
      allowed: stagePolicy(step).tools,
      observe(event) { if (run.step === step) recordToolCall(taskId, event); },
      before(name, input) {
        const active = authorizeRun(taskId, request.headers.get("authorization"));
        if (active.step !== step) throw new OperationError("RUN_STAGE_CHANGED", "실행 단계가 변경되었습니다.");
        if ((step === "analysis" || step === "production") && ["production_preview_project", "production_read_project"].includes(name)) {
          const projectId = (input as {projectId:string}).projectId;
          if (!productionStore().analysisInputs(taskId).some(row => row.project_id === projectId))
            throw new OperationError("ANALYSIS_SOURCE_NOT_ASSIGNED", "분석 자료 노드가 전달한 내부 게시글만 확인할 수 있습니다.");
        }
        if (name === "production_clone_project") {
          const sourceProjectId = (input as {sourceProjectId:string}).sourceProjectId;
          if (!active.sourceProjects.has(sourceProjectId))
            throw new OperationError("LAYOUT_SOURCE_NOT_REVIEWED", "복제할 원본의 실제 슬라이드를 먼저 미리보기로 확인해 주세요.");
        }
        if (name === "production_read_images") {
          const setId = (input as {set_id:string}).set_id;
          if (!referenceImagesAllowed(productionStore().db,taskId,step,setId))
            throw new Error(`먼저 이번 단계의 외부 레퍼런스로 조회해 주세요. 단계별 한도는 ${REFERENCE_LIMIT}개입니다.`);
        }
        if ((writeTools.includes(name) || editorReadTools.includes(name)) && !name.startsWith("production_")) {
          const projectId = (input as { projectId?: string }).projectId;
          if (projectId !== productionStore().get(taskId).task.project_id)
            throw new Error("이 작업에 연결된 프로젝트만 수정할 수 있습니다.");
          if (name === "edit_project" && projectId) {
            if (step === "production" && (input as {commands:Array<{type:string}>}).commands.some(command => command.type === "set_local_image"))
              throw new OperationError("GENERATED_IMAGE_IMPORT_REQUIRED", "새 이미지 생성 후 production_use_generated_image로 가져와 주세요. 과거 이미지나 임의 파일을 사용할 수 없습니다.");
            assertReviewWrite(step, input, contentJobRegistry.get(projectId).editor.document);
          }
        }
      },
      after(name, input, result) {
        if (run.step !== step) return;
        if (!result.isError && name === "production_query" && Array.isArray(result.structuredContent?.items))
          recordAnalysisRead(taskId, (result.structuredContent.items as Array<{id:string}>).map(row => row.id));
        if (!result.isError && name === "production_external_references") recordExternalComparison(taskId);
        if (!result.isError && result.content?.some(item => item.type === "image") && (name === "production_preview_project" || name === "production_read_images"))
          recordSourceReview(taskId, name === "production_preview_project" ? (input as {projectId:string}).projectId : undefined);
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
    assertUniqueProjectImages,
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
