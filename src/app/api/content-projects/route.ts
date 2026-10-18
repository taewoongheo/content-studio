import { documentStore } from "@/domains/slideshow/projects/persistence/document-store";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { hasUnsavedChanges } from "@/domains/slideshow/projects/lifecycle/management";
import { saveContentProject } from "@/domains/slideshow/projects/service";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { projectListEvents } from "@/domains/workspace/server/project-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  if (request.headers.get("accept")?.includes("text/event-stream")) return projectListEvents(request.signal);
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
    const { jobId, name, expectedTabId, onlyIfChanged } = body as Record<string, unknown>;
    if (typeof jobId !== "string" || typeof name !== "string" || !name.trim() || name.trim().length > 120)
      return Response.json({ error: "프로젝트 이름을 120자 이하로 입력해 주세요." }, { status: 400 });
    if (typeof expectedTabId === "string") contentJobRegistry.requireTab(jobId, expectedTabId);
    if (onlyIfChanged === true) {
      const stores = { projects: new ContentProjectStore(getLocalDatabase()) };
      if (!hasUnsavedChanges(contentJobRegistry.getRecord(jobId), stores)) {
        const saved = documentStore(stores, jobId).getSummary(jobId);
        if (saved) contentJobRegistry.update(jobId, job => {
          job.savedRevision = job.editor.revision;
          delete job.saveError;
        });
        return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
      }
    }
    return Response.json(await saveContentProject(contentJobRegistry, jobId, name), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return contentJobErrorResponse(error);
  }
}
