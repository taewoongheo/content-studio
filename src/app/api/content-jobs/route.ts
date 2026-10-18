import { projectTabEvents, listOpenProjectTabs } from "@/domains/workspace/server/tabs";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    return Response.json(contentJobRegistry.add({
      structure: "sequential", aspectRatio: "4:5", slideCount: 6, outputLanguage: "English",
    }), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}

export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  if (request.headers.get("accept")?.includes("text/event-stream")) return projectTabEvents(request.signal);
  return Response.json(listOpenProjectTabs(), { headers: { "Cache-Control": "no-store" } });
}
