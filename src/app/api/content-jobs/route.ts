import { contentWorkflow } from "@/lib/content-jobs/service";
import { contentJobErrorResponse } from "@/lib/content-jobs/http";
import { saveContentJobInput } from "@/lib/content-jobs/upload";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isLocalRequest(request, true))
    return new Response(null, { status: 403 });
  let cleanup: (() => Promise<void>) | undefined;
  try {
    const saved = await saveContentJobInput(await request.formData());
    cleanup = saved.cleanup;
    const job = await contentWorkflow.createJob(saved.input);
    return Response.json(job, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (cleanup) await cleanup();
    return contentJobErrorResponse(error);
  }
}
