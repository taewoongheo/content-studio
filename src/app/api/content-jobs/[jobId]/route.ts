import { contentJobEvents } from "@/lib/content-jobs/http/events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry, editorService } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ jobId: string }> };
export async function GET(request: Request, context: Context) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return contentJobEvents(contentJobRegistry, jobId, request.signal);
    return Response.json(contentJobRegistry.get(jobId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const { action, commands, expectedRevision } = body as Record<string, unknown>;
    if (!Number.isInteger(expectedRevision))
      return Response.json({ error: "현재 revision이 필요합니다." }, { status: 400 });
    if (action !== "editor_command" && action !== "editor_undo")
      return Response.json({ error: "지원하지 않는 작업입니다." }, { status: 400 });
    const job = action === "editor_command"
      ? editorService.applyCommands(jobId, commands, expectedRevision as number)
      : editorService.undo(jobId, expectedRevision as number);
    return Response.json(job, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return contentJobErrorResponse(error); }
}
