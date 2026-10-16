import * as z from "zod/v4";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ContentTemplateStore } from "@/lib/local-db/templates/store";
import { notifyProjectsChanged } from "@/lib/content-jobs/projects/events";
import { contentJobErrorResponse } from "@/lib/content-jobs/http/http";
export const runtime = "nodejs";
const schema = z.strictObject({ ids: z.array(z.string().min(1)), expectedIds: z.array(z.string().min(1)) });
export async function PUT(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "템플릿 순서를 확인해 주세요." }, { status: 400 });
    const templates = new ContentTemplateStore(getLocalDatabase()).reorder(parsed.data.ids, parsed.data.expectedIds);
    notifyProjectsChanged();
    return Response.json(templates);
  } catch (error) { return contentJobErrorResponse(error); }
}
