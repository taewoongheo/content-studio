import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { saveContentProject } from "@/lib/content-jobs/projects/service";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(new ContentProjectStore(getLocalDatabase()).list(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object")
      return Response.json({ error: "프로젝트 정보를 확인해 주세요." }, { status: 400 });
    const { jobId, name } = body as Record<string, unknown>;
    if (typeof jobId !== "string" || typeof name !== "string" || !name.trim() || name.trim().length > 120)
      return Response.json({ error: "프로젝트 이름을 120자 이하로 입력해 주세요." }, { status: 400 });
    return Response.json(await saveContentProject(contentJobRegistry, jobId, name), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
