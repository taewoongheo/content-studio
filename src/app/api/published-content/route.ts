import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { listContentOverview, listPublishedPosts } from "@/domains/content-production/server/publication/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const db = getLocalDatabase();
  return Response.json(new URL(request.url).searchParams.get("all") === "true" ? listContentOverview(db) : listPublishedPosts(db), {
    headers: { "Cache-Control": "no-store" },
  });
}
