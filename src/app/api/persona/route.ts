import { z } from "zod";
import { isLocalRequest } from "@/lib/http/local-request";
import { personaSettingsSchema } from "@/domains/content-production/domain/persona/model";
import { personaState, savePersona, startPersonaAnalysis } from "@/domains/content-production/server/persona/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("analyze"), handle: z.string().trim().min(1).max(200) }).strict(),
  z.object({ action: z.literal("save"), revision: z.number().int().positive(), settings: personaSettingsSchema }).strict(),
]);

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json(personaState(), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const input = inputSchema.parse(await request.json());
    if (input.action === "analyze") startPersonaAnalysis(input.handle);
    else savePersona(input.revision, input.settings);
    return Response.json(personaState(), { status: input.action === "analyze" ? 202 : 200 });
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError ? "입력 항목을 확인해 주세요." : error instanceof Error ? error.message : "페르소나 요청에 실패했습니다." }, { status: 400 });
  }
}
