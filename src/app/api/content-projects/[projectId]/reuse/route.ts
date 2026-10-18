import { COMPOSITION_LIMIT, ProjectReuseError, projectReuseUpdateSchema } from "@/domains/slideshow/projects/composition";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { updateContentProjectReuse } from "@/domains/slideshow/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { ContentTemplateStore } from "@/domains/slideshow/server/persistence/templates/store";
import { getLocalDatabase } from "@/lib/local-db/database";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";

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

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    new ContentTemplateStore(getLocalDatabase()).delete(projectId);
    notifyProjectsChanged();
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
