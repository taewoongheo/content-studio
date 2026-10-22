import {
  readProductionSettings,
  saveProductionSettings,
} from "@/domains/content-production/server/settings";
import { z } from "zod";
import { isLocalRequest } from "@/lib/http/local-request";
import {
  productionStore,
  startProduction,
  stopProduction,
  execute,
  syncState,
} from "@/domains/content-production/server/execution/runner";
import {
  productionEvents,
  publishChange,
} from "@/domains/content-production/server/events";
import {
  addReference,
  references,
} from "@/domains/content-production/server/persistence/library";
import { listVisuals } from "@/domains/content-production/server/publication/visuals";
import { registerPublication } from "@/domains/content-production/server/publication/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), settings: z.unknown() }),
  z.object({ action: z.literal("start"), count: z.number().int().positive() }),
  z.object({
    action: z.enum(["stop", "resume", "remove"]),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("edit_log"),
    id: z.string(),
    patch: z.unknown(),
  }),
  z.object({
    action: z.literal("register"),
    id: z.string(),
    url: z.string().url(),
  }),
  z.object({ action: z.literal("reference"), reference: z.unknown() }),
  z.object({ action: z.literal("remove_reference"), id: z.string() }),
]);
export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  try {
    const store = productionStore();
    if (request.headers.get("accept")?.includes("text/event-stream"))
      return productionEvents(request.signal);
    const params = new URL(request.url).searchParams,
      id = params.get("id");
    if (params.has("image")) {
      const image = store.db
        .prepare(
          "SELECT data FROM content_visual_slides WHERE set_id=? AND slide_index=?",
        )
        .get(params.get("image"), Number(params.get("slide") ?? 0)) as
        { data: Buffer } | undefined;
      return image
        ? new Response(new Uint8Array(image.data), {
            headers: {
              "Content-Type": "image/webp",
              "Cache-Control": "private,max-age=31536000,immutable",
            },
          })
        : new Response(null, { status: 404 });
    }
    return Response.json(
      id
        ? store.get(id)
        : {
            tasks: store.list(),
            logs: store.logs(params.get("query") ?? ""),
            references: references(store.db),
            visuals: listVisuals(store.db),
            sync: syncState(),
            settings: readProductionSettings(),
            configured: { apify: !!process.env.APIFY_API_TOKEN },
          },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "조회 실패" },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  if (!isLocalRequest(request, true))
    return new Response(null, { status: 403 });
  try {
    const input = requestSchema.parse(await request.json()),
      store = productionStore();
    const origin = new URL(
      `${new URL(request.url).protocol}//${request.headers.get("host")}`,
    ).origin;
    switch (input.action) {
      case "settings":
        return Response.json(saveProductionSettings(input.settings));
      case "start":
        return Response.json({
          ids: await startProduction(input.count, origin),
        });
      case "stop":
        stopProduction(input.id);
        break;
      case "remove":
        stopProduction(input.id, true);
        break;
      case "resume": {
        const detail = store.get(input.id);
        if (!["stopped", "failed"].includes(detail.task.state))
          throw new Error("중단·실패한 작업만 재개할 수 있습니다.");
        void execute(input.id, origin).catch((error) => {
          try {
            store.state(
              input.id,
              "failed",
              error instanceof Error ? error.message : "실행 실패",
            );
          } catch {}
        });
        break;
      }
      case "edit_log":
        store.editLog(input.id, input.patch);
        break;
      case "register":
        return Response.json(
          await registerPublication(store.db, input.id, input.url),
        );
      case "reference":
        return Response.json(await addReference(store.db, input.reference));
      case "remove_reference":
        store.db
          .prepare("DELETE FROM content_references WHERE id=?")
          .run(input.id);
        publishChange({ kind: "library" });
        break;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "처리 실패" },
      { status: 400 },
    );
  }
}
