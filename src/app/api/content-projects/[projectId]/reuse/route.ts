import { projectReuseUpdateSchema } from "@/lib/content-jobs/projects/composition";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const parsed = projectReuseUpdateSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "구성은 2000자 이하로 입력하고 템플릿 등록 여부를 확인해 주세요." }, { status: 400 });
    const { composition, isTemplate } = parsed.data;
    const { projectId } = await context.params;
    const projects = new ContentProjectStore(getLocalDatabase());
    const project = projects.getSummary(projectId);
    if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    if ((isTemplate ?? project.isTemplate) && !(composition === undefined ? project.composition : composition).trim())
      return Response.json({ error: "템플릿으로 등록하려면 구성을 입력해 주세요." }, { status: 422 });
    const updated = projects.updateReuse(projectId, {
      composition, isTemplate,
    });
    notifyProjectsChanged();
    return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
