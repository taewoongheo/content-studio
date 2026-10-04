import { COMPOSITION_LIMIT, ProjectReuseError, projectReuseUpdateSchema } from "@/lib/content-jobs/projects/composition";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { updateContentProjectReuse } from "@/lib/content-jobs/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const parsed = projectReuseUpdateSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: `구성은 ${COMPOSITION_LIMIT}자 이하로 입력하고 템플릿 등록 여부를 확인해 주세요.` }, { status: 400 });
    const { projectId } = await context.params;
    const updated = updateContentProjectReuse(projectId, parsed.data);
    return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ProjectReuseError)
      return Response.json({ error: error.message }, { status: error.code === "PROJECT_NOT_FOUND" ? 404 : 422 });
    return contentJobErrorResponse(error);
  }
}
