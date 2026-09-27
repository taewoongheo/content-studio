import { addEditorAsset, attachStoredEditorAsset } from "@/lib/content-jobs/editor/assets";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body: unknown = await request.json().catch(() => null);
      const assetId = body && typeof body === "object" && "assetId" in body ? body.assetId : null;
      if (typeof assetId !== "string" || !assetId.trim())
        return Response.json({ error: "저장된 이미지를 선택해 주세요." }, { status: 400 });
      return Response.json(attachStoredEditorAsset(contentJobRegistry, jobId, assetId), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const file = (await request.formData()).get("image");
    if (!(file instanceof File))
      return Response.json({ error: "이미지를 선택해 주세요." }, { status: 400 });
    return Response.json(await addEditorAsset(contentJobRegistry, jobId, file), {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
