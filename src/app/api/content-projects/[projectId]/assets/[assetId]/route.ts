import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { cachedRenderImage } from "@/domains/slideshow/editor/image-processing/cache";
import { imageRenderSize } from "@/domains/slideshow/editor/image-processing/options";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ projectId: string; assetId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { projectId, assetId } = await context.params;
    const source = defaultProjectStores().projects.getAsset(projectId, assetId);
    if (!source) return new Response(null, { status: 404 });
    const size = imageRenderSize(new URL(request.url).searchParams);
    const { bytes, type } = size ? await cachedRenderImage(source, size) : source;
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return contentJobErrorResponse(error); }
}
