import { contentMetadataSchema } from "@/lib/content-jobs/projects/composition";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { defaultProjectStores } from "@/lib/content-jobs/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const parsed = contentMetadataSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "주제와 핵심 메시지를 입력해 주세요. 주제는 200자, 메시지는 2000자까지 가능합니다." }, { status: 400 });
    const { projectId } = await context.params;
    const project = defaultProjectStores().projects.updateMetadata(projectId, parsed.data);
    notifyProjectsChanged();
    return Response.json(project, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
