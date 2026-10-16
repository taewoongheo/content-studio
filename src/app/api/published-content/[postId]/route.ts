import { isLocalRequest } from "@/lib/http/local-request";
import { defaultProjectStores } from "@/lib/content-jobs/projects/service";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
export const runtime = "nodejs";
export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { postId } = await context.params;
    defaultProjectStores().projects.unpublish(postId);
    notifyProjectsChanged();
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
