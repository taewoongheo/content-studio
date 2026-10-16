import { isLocalRequest } from "@/lib/http/local-request";
import { createVideo, videoStore } from "@/lib/video/server/service";
import { videoError } from "@/lib/video/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try { return Response.json(videoStore().list(), { headers: { "Cache-Control": "no-store" } }); } catch (e) { return videoError(e); }
}
export function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try { return Response.json(createVideo(), { status: 201 }); } catch (e) { return videoError(e); }
}
