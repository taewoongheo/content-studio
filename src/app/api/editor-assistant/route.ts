import { z } from "zod";
import { isLocalRequest } from "@/lib/http/local-request";
import { assistantStatus, startAssistant, stopAssistant } from "@/domains/workspace/assistant/server/service";
const target = z.object({ projectId: z.string().min(1), tabId: z.string().uuid(), projectType: z.enum(["slideshow", "video"]) });
const selection = z.object({ slideIds: z.array(z.string()).max(20).optional(), placementIds: z.array(z.string()).max(200).optional(),
  layerIds: z.array(z.string()).max(200).optional(), frame: z.number().int().nonnegative().optional() });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try { return Response.json(assistantStatus(target.parse(Object.fromEntries(new URL(request.url).searchParams))), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "조회 실패" }, { status: 400 }); }
}
export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const input = target.extend({ action: z.enum(["start", "stop"]), message: z.string().trim().min(1).max(12000).optional(),
      requestId: z.string().uuid().optional(), selection: selection.default({}) }).parse(await request.json());
    if (input.action === "stop") { assistantStatus(input); stopAssistant(input.tabId); return Response.json(assistantStatus(input)); }
    if (!input.message || !input.requestId) throw new Error("명령과 요청 ID가 필요합니다.");
    return Response.json(startAssistant(input, input.selection, input.message, input.requestId, new URL(request.url).origin), { status: 202 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "실행 실패" }, { status: 400 }); }
}
