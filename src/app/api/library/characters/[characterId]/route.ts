import { isLocalRequest } from "@/lib/http/local-request";
import { CharacterStore } from "@/lib/local-db/characters";
import { getLocalDatabase } from "@/lib/local-db/database";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ characterId: string }> }) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  const { characterId } = await context.params;
  if (!new CharacterStore(getLocalDatabase()).delete(characterId))
    return Response.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  return new Response(null, { status: 204 });
}
