import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { loadContentProject } from "@/lib/content-jobs/projects/service";
import { contentWorkflow } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    const body: unknown = await request.json();
    const model = body && typeof body === "object" ? (body as Record<string, unknown>).model : null;
    if (typeof model !== "string" || !model.trim())
      return Response.json({ error: "사용할 Codex 모델을 선택해 주세요." }, { status: 400 });
    return Response.json(await loadContentProject(contentWorkflow, projectId, model), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
