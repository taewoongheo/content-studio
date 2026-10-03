import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { parsePublishedPostInput, PublishedPostStore } from "@/lib/local-db/published-posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(new PublishedPostStore(getLocalDatabase()).list(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  let input;
  try {
    input = parsePublishedPostInput(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "게시 기록을 확인해 주세요." }, { status: 400 });
  }
  return Response.json(new PublishedPostStore(getLocalDatabase()).create(input), {
    status: 201, headers: { "Cache-Control": "no-store" },
  });
}
