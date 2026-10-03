import { isLocalRequest } from "@/lib/http/local-request";
import { CharacterStore } from "@/lib/local-db/characters";
import { getLocalDatabase } from "@/lib/local-db/database";
import { imageTypes, MAX_REFERENCE_IMAGE_BYTES, validSignature } from "@/lib/content-jobs/http/upload";
import type { ImageMimeType } from "@/lib/local-db/assets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  let form: FormData;
  try { form = await request.formData(); } catch { return Response.json({ error: "캐릭터 정보를 확인해 주세요." }, { status: 400 }); }
  const description = form.get("description");
  const image = form.get("image");
  if (typeof description !== "string" || !description.trim() || description.length > 2000)
    return Response.json({ error: "캐릭터 설명이 필요합니다." }, { status: 400 });
  if (!(image instanceof File) || !(image.type in imageTypes) || image.size === 0 || image.size > MAX_REFERENCE_IMAGE_BYTES)
    return Response.json({ error: "PNG, JPG, WebP 턴어라운드 이미지를 10MB 이하로 추가해 주세요." }, { status: 400 });
  const bytes = new Uint8Array(await image.arrayBuffer());
  const type = image.type as ImageMimeType;
  if (!validSignature(type, bytes))
    return Response.json({ error: "이미지 파일 형식을 확인해 주세요." }, { status: 400 });
  const character = new CharacterStore(getLocalDatabase()).create({ description, type, bytes });
  return Response.json(character, { status: 201, headers: { "Cache-Control": "no-store" } });
}
