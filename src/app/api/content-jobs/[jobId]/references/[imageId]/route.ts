import { readFile } from "node:fs/promises";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { ContentJobError } from "@/lib/content-jobs/workflow/registry";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string; imageId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId, imageId } = await context.params;
    const image = contentJobRegistry.getRecord(jobId).referenceImages.find((item) => item.id === imageId);
    if (!image) throw new ContentJobError("JOB_NOT_FOUND", "레퍼런스 이미지를 찾을 수 없습니다.");
    return new Response(new Uint8Array(await readFile(image.path)), {
      headers: { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
