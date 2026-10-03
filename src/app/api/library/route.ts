import { isLocalRequest } from "@/lib/http/local-request";
import { AssetStore } from "@/lib/local-db/assets";
import { CharacterStore } from "@/lib/local-db/characters";
import { getLocalDatabase } from "@/lib/local-db/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  const database = getLocalDatabase();
  return Response.json({
    characters: new CharacterStore(database).list(),
    assets: new AssetStore(database).list(),
  }, { headers: { "Cache-Control": "no-store" } });
}
