import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { listFormalContent, listPublishedPosts } from "@/domains/content-production/server/publication/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const db = getLocalDatabase();
  const posts = listPublishedPosts(db);
  return Response.json(new URL(request.url).searchParams.get("all") === "true" ? {posts, projects:listFormalContent(db)} : posts, {
    headers: { "Cache-Control": "no-store" },
  });
}
