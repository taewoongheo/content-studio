import { codexConnection } from "@/lib/codex/connection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLocalRequest(request: Request, mutation = false) {
  const host = request.headers.get("host");
  if (!host) return false;
  // Next.js can normalize request.url to a different loopback hostname.
  // Compare the browser's Origin to the validated incoming Host instead.
  const url = new URL(`${new URL(request.url).protocol}//${host}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  return mutation ? origin === url.origin : !origin || origin === url.origin;
}

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
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
