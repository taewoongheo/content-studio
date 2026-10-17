import { isLocalRequest } from "@/lib/http/local-request";
import { openVideo, writeVideo, historyVideo, renameVideo, closeVideo, deleteVideoGuarded, cloneVideo } from "@/domains/video/server/service";
import { videoError } from "@/domains/video/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(req: Request, ctx: Context) {
  if (!isLocalRequest(req)) return new Response(null, { status: 403 });
  try { return Response.json(openVideo((await ctx.params).projectId), { headers: { "Cache-Control": "no-store" } }); } catch (e) { return videoError(e); }
}
export async function PUT(req: Request, ctx: Context) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try {
    const b = await req.json();
    if (!Number.isInteger(b.expectedRevision)) throw new Error("현재 revision이 필요합니다.");
    return Response.json(writeVideo((await ctx.params).projectId, b.expectedTabId, b.expectedRevision, b.document));
  } catch (e) { return videoError(e); }
}
export async function POST(req: Request, ctx: Context) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try {
    const b = await req.json(), { projectId } = await ctx.params;
    if (b.action === "clone") return Response.json(cloneVideo(projectId));
    if (!Number.isInteger(b.expectedRevision)) throw new Error("현재 revision이 필요합니다.");
    if (b.action === "close") { closeVideo(projectId, b.expectedTabId, b.expectedRevision); return new Response(null, { status: 204 }); }
    if (b.action === "undo" || b.action === "redo") return Response.json(historyVideo(projectId, b.expectedTabId, b.expectedRevision, b.action === "redo"));
    throw new Error("지원하지 않는 작업입니다.");
  } catch (e) { return videoError(e); }
}
export async function PATCH(req: Request, ctx: Context) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try { const b = await req.json(); if (typeof b.name !== "string") throw new Error("이름을 입력해 주세요."); renameVideo((await ctx.params).projectId, b.name, b.expectedTabId); return new Response(null, { status: 204 }); } catch (e) { return videoError(e); }
}
export async function DELETE(req: Request, ctx: Context) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try { const body = await req.json(); deleteVideoGuarded((await ctx.params).projectId, body.expectedTabId, body.expectedRevision); return new Response(null, { status: 204 }); } catch (e) { return videoError(e); }
}
