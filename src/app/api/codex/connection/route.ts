import { codexConnection } from "@/lib/codex/connection";
import { connectionEvents } from "@/lib/codex/connection-events";
import { isLocalRequest } from "@/lib/http/local-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  if (request.headers.get("accept")?.includes("text/event-stream")) {
    return connectionEvents(codexConnection, request.signal);
  }
  return Response.json(codexConnection.snapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request, true))
    return new Response(null, { status: 403 });
  let action: unknown;
  try {
    action = (await request.json()).action;
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (
    action !== "connect" &&
    action !== "disconnect" &&
    action !== "reconnect"
  ) {
    return Response.json(
      { error: "지원하지 않는 작업입니다." },
      { status: 400 },
    );
  }
  if (action === "disconnect" || action === "reconnect")
    await codexConnection.disconnect();
  const state =
    action === "disconnect"
      ? codexConnection.snapshot()
      : await codexConnection.connect();
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
