import { contentJobErrorResponse } from "@/domains/slideshow/http/http";
import { defaultProjectStores } from "@/domains/slideshow/projects/service";
import { updateTemplateSettings, deleteTemplate } from "@/domains/slideshow/templates/service";
import { templateSettingsSchema } from "@/domains/slideshow/templates/metadata";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { isLocalRequest } from "@/lib/http/local-request";
export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ templateId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { templateId } = await context.params;
    const input = templateSettingsSchema.parse(await request.json());
    return Response.json(updateTemplateSettings(contentJobRegistry, defaultProjectStores().projects, templateId, input));
  } catch (error) { return contentJobErrorResponse(error); }
}
export async function DELETE(request: Request, context: { params: Promise<{ templateId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const { templateId } = await context.params;
    deleteTemplate(contentJobRegistry, defaultProjectStores().projects, templateId);
    return new Response(null, { status: 204 });
  } catch (error) { return contentJobErrorResponse(error); }
}
