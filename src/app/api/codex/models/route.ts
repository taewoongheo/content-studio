import { codexConnection } from "@/lib/codex/connection/connection";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  if (codexConnection.snapshot().status !== "connected")
    return Response.json(
      { error: "Codex에 연결한 뒤 모델을 선택해 주세요." },
      { status: 409 },
    );
  try {
    return Response.json(await codexConnection.listModels(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "사용 가능한 Codex 모델을 불러오지 못했습니다." },
      { status: 503 },
    );
  }
}
