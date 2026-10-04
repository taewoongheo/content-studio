import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ error: "재사용 설정을 확인해 주세요." }, { status: 400 });
    const { reuseGuide, isTemplate } = body as Record<string, unknown>;
    if ((reuseGuide !== undefined && (typeof reuseGuide !== "string" || reuseGuide.trim().length > 4000))
      || (isTemplate !== undefined && typeof isTemplate !== "boolean")
      || (reuseGuide === undefined && isTemplate === undefined))
      return Response.json({ error: "재사용 가이드는 4000자 이하로 입력하고 템플릿 등록 여부를 확인해 주세요." }, { status: 400 });
    const { projectId } = await context.params;
    const projects = new ContentProjectStore(getLocalDatabase());
    const project = projects.getSummary(projectId);
    if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    if ((isTemplate ?? project.isTemplate) && !(typeof reuseGuide === "string" ? reuseGuide.trim() : project.reuseGuide))
      return Response.json({ error: "템플릿으로 등록하려면 재사용 가이드를 입력해 주세요." }, { status: 422 });
    const updated = projects.updateReuse(projectId, {
      reuseGuide: reuseGuide as string | undefined, isTemplate: isTemplate as boolean | undefined,
    });
    notifyProjectsChanged();
    return Response.json(updated, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
