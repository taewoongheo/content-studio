import { imageTypes, MAX_UPLOAD_IMAGE_BYTES, validSignature } from "@/lib/content-jobs/http/upload";
import { isLocalRequest } from "@/lib/http/local-request";
import { AssetStore, type ImageMimeType } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  const form = await request.formData();
  const file = form.get("image");
  const name = form.get("name");
  const description = form.get("description");
  if (!(file instanceof File) || !(file.type in imageTypes) || file.size === 0 || file.size > MAX_UPLOAD_IMAGE_BYTES)
    return Response.json({ error: "PNG, JPG, WebP 이미지를 10MB 이하로 추가해 주세요." }, { status: 400 });
  if (typeof name !== "string" || !name.trim() || name.length > 120 ||
      typeof description !== "string" || description.length > 2000)
    return Response.json({ error: "이미지 이름과 설명을 확인해 주세요." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = file.type as ImageMimeType;
  if (!validSignature(type, bytes))
    return Response.json({ error: "이미지 파일 형식을 확인해 주세요." }, { status: 400 });
  const asset = new AssetStore(getLocalDatabase()).create({ name, description, type, bytes });
  return Response.json(asset, { status: 201, headers: { "Cache-Control": "no-store" } });
}
