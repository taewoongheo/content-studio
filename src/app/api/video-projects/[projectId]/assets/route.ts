import { validateVideoUpload, videoMediaTypes } from "@/domains/video/server/media/upload";
import { isLocalRequest } from "@/lib/http/local-request";
import { uploadVideoAsset } from "@/domains/video/server/service";
import { videoError } from "@/domains/video/server/http";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  if (!isLocalRequest(req, true)) return new Response(null, { status: 403 });
  try {
    if (Number(req.headers.get("content-length")) > 201 * 1024 * 1024) throw new Error("파일은 최대 200MB까지 추가할 수 있습니다.");
    const form = await req.formData(), file = form.get("file");
    if (!(file instanceof File) || !videoMediaTypes.has(file.type) || !file.size || file.size > 200 * 1024 * 1024) throw new Error("최대 200MB의 영상·음악·이미지를 선택해 주세요.");
    const bytes = Buffer.from(await file.arrayBuffer());
    validateVideoUpload(file.type, bytes);
    return Response.json(uploadVideoAsset((await ctx.params).projectId, form.get("tabId"), file.name.slice(0, 200), file.type, bytes));
  } catch (e) { return videoError(e); }
}
