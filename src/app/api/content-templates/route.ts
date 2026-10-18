import { z } from "zod/v4";
import { templateCreateSchema } from "@/domains/slideshow/templates/metadata";
import { createTemplateFromProject } from "@/domains/slideshow/templates/service";
import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { isLocalRequest } from "@/lib/http/local-request";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(defaultProjectStores().projects.listTemplates(true), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { projectId, ...input } = templateCreateSchema.extend({ projectId: z.string().min(1) }).parse(await request.json());
    return Response.json(createTemplateFromProject(defaultProjectStores().projects, projectId, input), { status: 201 });
  } catch (error) { return contentJobErrorResponse(error); }
}
