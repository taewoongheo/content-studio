import { readEditorAsset } from "@/lib/content-jobs/editor/assets";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { imageRenderSize } from "@/lib/content-jobs/editor/image-processing/options";
import { cachedRenderImage } from "@/lib/content-jobs/editor/image-processing/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string; assetId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId, assetId } = await context.params;
    const size = imageRenderSize(new URL(request.url).searchParams);
    const source = await readEditorAsset(contentJobRegistry, jobId, assetId);
    const { bytes, type } = size ? await cachedRenderImage(source, size) : source;
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
