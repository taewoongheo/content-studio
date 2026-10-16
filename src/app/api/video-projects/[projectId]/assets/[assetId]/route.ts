import { isLocalRequest } from "@/lib/http/local-request";
import { videoStore } from "@/lib/video/server/service";
export const runtime = "nodejs";
export async function GET(req: Request, ctx: { params: Promise<{ projectId: string; assetId: string }> }) {
  if (!isLocalRequest(req)) return new Response(null, { status: 403 });
  const { projectId, assetId } = await ctx.params;
  const asset = videoStore().asset(projectId, assetId);
  if (!asset) return new Response(null, { status: 404 });
  const size = asset.data.length;
  const headers = new Headers({ "Content-Type": asset.type, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = match?.[1] ? Number(match[1]) : Math.max(0, size - Number(match?.[2]));
    const end = match?.[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (!match || !Number.isSafeInteger(start) || start < 0 || start >= size || end < start) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`); headers.set("Content-Length", String(end - start + 1));
    return new Response(new Uint8Array(asset.data.subarray(start, end + 1)), { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(new Uint8Array(asset.data), { headers });
}
