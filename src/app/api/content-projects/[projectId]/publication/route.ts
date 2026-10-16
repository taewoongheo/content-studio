import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { defaultProjectStores } from "@/lib/content-jobs/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    const project = defaultProjectStores().projects.publish(projectId);
    notifyProjectsChanged();
    return Response.json(project, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    defaultProjectStores().projects.unpublish(projectId);
    notifyProjectsChanged();
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
