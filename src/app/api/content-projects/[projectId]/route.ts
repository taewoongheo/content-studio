import { renameProject, deleteProject } from "@/lib/content-jobs/projects/lifecycle/management";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
import { loadContentProject } from "@/lib/content-jobs/projects/service";
import { contentJobRegistry } from "@/lib/content-jobs/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    return Response.json(await loadContentProject(contentJobRegistry, projectId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) { return contentJobErrorResponse(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ error: "프로젝트 정보를 확인해 주세요." }, { status: 400 });
    const { name, expectedTabId } = body as Record<string, unknown>;
    if (typeof name !== "string" || (expectedTabId !== undefined && typeof expectedTabId !== "string"))
      return Response.json({ error: "프로젝트 정보를 확인해 주세요." }, { status: 400 });
    renameProject(contentJobRegistry, projectId, name, expectedTabId);
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      return Response.json({ error: "프로젝트 정보를 확인해 주세요." }, { status: 400 });
    const { expectedTabId } = body as Record<string, unknown>;
    if (expectedTabId !== undefined && typeof expectedTabId !== "string")
      return Response.json({ error: "탭 정보를 확인해 주세요." }, { status: 400 });
    deleteProject(contentJobRegistry, projectId, expectedTabId);
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
