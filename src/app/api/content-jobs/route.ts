import { projectTabEvents } from "@/lib/content-jobs/http/tab-events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
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
  if (request.headers.get("accept")?.includes("text/event-stream")) return projectTabEvents(contentJobRegistry, request.signal);
  return Response.json(contentJobRegistry.tabs(), { headers: { "Cache-Control": "no-store" } });
}
