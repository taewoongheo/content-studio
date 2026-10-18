import { documentStore } from "@/domains/slideshow/projects/persistence/document-store";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    const project = documentStore(defaultProjectStores(), projectId).getContent(projectId);
    if (!project) return Response.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });
    return Response.json(project.document, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
