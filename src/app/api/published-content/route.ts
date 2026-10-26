import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { listPublishedPosts } from "@/domains/content-production/server/publication/list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(listPublishedPosts(getLocalDatabase()), {
    headers: { "Cache-Control": "no-store" },
  });
}
