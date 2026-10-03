import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { loadContentProject } from "@/lib/content-jobs/projects/service";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    return Response.json(await loadContentProject(contentJobRegistry, projectId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return contentJobErrorResponse(error); }
}
