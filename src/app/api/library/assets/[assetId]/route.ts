import { isLocalRequest } from "@/lib/http/local-request";
import { AssetStore } from "@/lib/local-db/assets";
import { getLocalDatabase } from "@/lib/local-db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const { assetId } = await context.params;
  const image = new AssetStore(getLocalDatabase()).readImage(assetId);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ assetId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  const { assetId } = await context.params;
  try {
    if (!new AssetStore(getLocalDatabase()).delete(assetId))
      return Response.json({ error: "이미지를 찾을 수 없습니다." }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "이미지를 삭제하지 못했습니다." }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}
