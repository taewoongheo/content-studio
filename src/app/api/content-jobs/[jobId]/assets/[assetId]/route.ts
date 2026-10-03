import { readEditorAsset } from "@/lib/content-jobs/editor/assets";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string; assetId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId, assetId } = await context.params;
    const { bytes, type } = await readEditorAsset(contentJobRegistry, jobId, assetId);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
