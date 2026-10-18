import { isLocalRequest } from "@/lib/http/local-request";
import { readVideo } from "@/domains/video/server/service";
import { renderVideo } from "@/domains/video/server/rendering/render";
import { videoError } from "@/domains/video/server/http";
export const runtime = "nodejs";
export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try {
    const b = await req.json();
    const snapshot = readVideo((await ctx.params).projectId);
    if (snapshot.tabId !== b.expectedTabId || snapshot.revision !== b.expectedRevision) throw new Error("최신 내용을 저장한 뒤 다시 내보내 주세요.");
    return new Response(new Uint8Array(await renderVideo(snapshot)), { headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=content-studio.mp4", "Cache-Control": "no-store" } });
  } catch (e) { return videoError(e); }
}
