import { isLocalRequest } from "@/lib/http/local-request";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { notifyProjectsChanged } from "@/domains/workspace/server/project-events";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
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
