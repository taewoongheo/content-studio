import { contentJobEvents } from "@/lib/content-jobs/events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http";
import {
  contentJobRegistry,
  contentWorkflow,
} from "@/lib/content-jobs/service";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return contentJobEvents(contentJobRegistry, jobId, request.signal);
    return Response.json(contentJobRegistry.get(jobId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  if (!isLocalRequest(request, true))
    return new Response(null, { status: 403 });
  try {
    const { jobId } = await context.params;
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null)
      return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const action = input.action;
    const generation = {
      analyze_reference: () => contentWorkflow.analyzeReference(jobId),
      generate_strategies: () => contentWorkflow.generateStrategies(jobId),
      generate_copy: () => contentWorkflow.generateCopy(jobId),
      generate_hooks: () => contentWorkflow.generateHooks(jobId),
    } as const;
    if (typeof action === "string" && action in generation) {
      const running = generation[action as keyof typeof generation]();
      void running.catch(() => {});
      return Response.json(contentJobRegistry.get(jobId), {
        status: 202,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!Number.isInteger(input.expectedRevision))
      return Response.json(
        { error: "현재 revision이 필요합니다." },
        { status: 400 },
      );
    const revision = input.expectedRevision as number;
    let job;
    switch (action) {
      case "accept_reference":
        job = contentWorkflow.acceptReference(jobId, input.value, revision);
        break;
      case "accept_strategy":
        if (typeof input.selectedId !== "string")
          return Response.json(
            { error: "선택한 전략이 필요합니다." },
            { status: 400 },
          );
        job = contentWorkflow.acceptStrategy(
          jobId,
          input.value,
          input.selectedId,
          revision,
        );
        break;
      case "accept_copy":
        job = contentWorkflow.acceptCopy(jobId, input.value, revision);
        break;
      case "accept_hook":
        if (typeof input.selectedId !== "string")
          return Response.json(
            { error: "선택한 훅이 필요합니다." },
            { status: 400 },
          );
        job = contentWorkflow.acceptHook(
          jobId,
          input.value,
          input.selectedId,
          revision,
        );
        break;
      default:
        return Response.json(
          { error: "지원하지 않는 작업입니다." },
          { status: 400 },
        );
    }
    return Response.json(job, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
