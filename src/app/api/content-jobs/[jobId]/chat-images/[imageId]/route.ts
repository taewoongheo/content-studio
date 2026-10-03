import { readChatImage } from "@/lib/content-jobs/editor/workflow/attachments/chat-images";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ jobId: string; imageId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId, imageId } = await context.params;
    const image = await readChatImage(contentJobRegistry.getRecord(jobId), imageId);
    return new Response(new Uint8Array(image.bytes), {
      headers: { "Content-Type": image.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
