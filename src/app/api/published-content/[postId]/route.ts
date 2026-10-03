import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { PublishedPostStore } from "@/lib/local-db/published-posts";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ postId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  const { postId } = await context.params;
  if (!new PublishedPostStore(getLocalDatabase()).delete(postId))
    return Response.json({ error: "게시 기록을 찾을 수 없습니다." }, { status: 404 });
  return new Response(null, { status: 204 });
}
