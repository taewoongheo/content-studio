import { addEditorAsset } from "@/lib/content-jobs/editor/assets";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    const tabId = request.headers.get("x-tab-id") ?? contentJobRegistry.getRecord(jobId).tabId;
    contentJobRegistry.requireTab(jobId, tabId);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      return Response.json({ error: "이미지 파일을 업로드해 주세요." }, { status: 400 });
    const file = (await request.formData()).get("image");
    if (!(file instanceof File))
      return Response.json({ error: "이미지를 선택해 주세요." }, { status: 400 });
    contentJobRegistry.requireTab(jobId, tabId);
    return Response.json(await addEditorAsset(contentJobRegistry, jobId, file), {
      status: 201, headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
