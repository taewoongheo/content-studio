import { isLocalRequest } from "@/lib/http/local-request";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { toPublishedPost } from "@/domains/slideshow/projects/published-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(defaultProjectStores().projects.listPublished().map(toPublishedPost), {
    headers: { "Cache-Control": "no-store" },
  });
}
