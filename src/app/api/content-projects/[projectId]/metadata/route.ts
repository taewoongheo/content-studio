import { contentMetadataSchema } from "@/domains/slideshow/projects/metadata";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import { updateContentMetadata } from "@/domains/content-production/server/projects";
import { getLocalDatabase } from "@/lib/local-db/database";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const parsed = contentMetadataSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "소재·메시지·포맷을 입력해 주세요. 각각 200자·2000자·1000자까지 가능합니다." }, { status: 400 });
    const { projectId } = await context.params;
    const project = updateContentMetadata(getLocalDatabase(), projectId, parsed.data);
    notifyProjectsChanged();
    return Response.json(project, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
