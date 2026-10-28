import { reportSourceKey } from "@/domains/content-production/domain/report/model";
import { buildReportInput } from "@/domains/content-production/server/display/report/input";
import { readStageReport } from "@/domains/content-production/server/display/report/service";
import { listPublishedPosts } from "@/domains/content-production/server/publication/list";
import { productionRequestsSchema } from "@/domains/content-production/domain/start/input";
import { streamDisplayTranslation } from "@/domains/content-production/server/display/stream";
import { z } from "zod";
import { isLocalRequest } from "@/lib/http/local-request";
import {
  productionStore,
  startProduction,
  stopProduction,
  resetProduction,
  execute,
  syncState,
} from "@/domains/content-production/server/execution/runner";
import {
  productionEvents,
} from "@/domains/content-production/server/events";
import { accountIdentity, addReferenceAccount, referenceAccounts, externalReferences, removeReferenceAccount, setReferenceExcluded } from "@/domains/content-production/server/references/library";
import { refreshSpy, spyStatus } from "@/domains/content-production/server/references/spy/refresh";
import { readSampling, saveSampling } from "@/domains/content-production/server/settings/sampling";
import { samplingSchema } from "@/domains/content-production/domain/references/sampling";
import { listVisuals } from "@/domains/content-production/server/publication/visuals";
import { registerPublication } from "@/domains/content-production/server/publication/service";
import { deleteTaskProject } from "@/domains/content-production/server/projects";
import { stepSchema } from "@/domains/content-production/domain/contracts";
import { displayContent } from "@/domains/content-production/domain/display";
import { translateDisplay } from "@/domains/content-production/server/display/translation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.discriminatedUnion("action", [
  z.object({action:z.literal("stage_report"),id:z.string().min(1),step:stepSchema,sourceKey:z.string().max(2000000)}),
  z.object({ action: z.literal("reset") }),
  z.object({ action: z.literal("translate_display"), id: z.string().min(1), step: stepSchema, stream: z.boolean().optional() }),
  z.object({ action: z.literal("start"), requests: productionRequestsSchema }),
  z.object({
    action: z.enum(["stop", "resume", "remove"]),
    id: z.string().min(1),
    step: stepSchema.optional(),
  }),
  z.object({ action: z.literal("delete_post"), id: z.string().min(1) }),
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
  z.object({ action: z.literal("reference_account"), account: z.string().min(1) }),
  z.object({ action: z.literal("remove_reference_account"), username: z.string() }),
  z.object({ action: z.literal("refresh_spy") }),
  z.object({ action: z.literal("sampling_settings"), settings: samplingSchema }),
  z.object({ action: z.literal("exclude_reference"), id: z.string(), excluded: z.boolean() }),
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
    const tasks = id ? [] : store.list();
    return Response.json(
      id
        ? store.get(id)
        : {
            tasks,
            sampling: readSampling(store.db),
            spy: spyStatus(store.db),
            publishedPosts: listPublishedPosts(store.db),
            logs: store.logs(params.get("query") ?? ""),
            planningLogs: tasks.length ? store.analysisInputs(tasks[0].id) : store.planningLogs(),
            externalReferences: externalReferences(store.db, "", "", true),
            referenceAccounts: referenceAccounts(store.db),
            visuals: listVisuals(store.db),
            sync: syncState(),
            configured: { apify: !!process.env.APIFY_API_TOKEN?.trim() },
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
      case "stage_report": {
        const detail=store.get(input.id),sourceKey=reportSourceKey(detail,input.step);
        if(!sourceKey||sourceKey!==input.sourceKey)return Response.json({error:"단계 내용이 갱신되었습니다. 다시 확인해 주세요."},{status:409});
        const report=await readStageReport(buildReportInput(detail,input.step,store.analysisInputs(input.id)),request.signal);
        return Response.json({sourceKey,report},{headers:{"Cache-Control":"no-store"}});
      }
      case "translate_display": {
        const detail = store.get(input.id);
        const context = detail[input.step];
        const source = displayContent(context ?? {});
        if (input.stream) return streamDisplayTranslation(source, request.signal);
        return Response.json({ source, translated: await translateDisplay(source, request.signal) }, { headers: { "Cache-Control": "no-store" } });
      }
      case "reset":
        resetProduction();
        break;
      case "start":
        return Response.json({
          ids: await startProduction(input.requests, origin),
        });
      case "stop":
        if (input.step) {
          const task = store.get(input.id).task;
          if (task.current_step !== input.step || !["running", "pending"].includes(task.state))
            throw new Error("현재 실행 중인 단계가 변경되었습니다.");
        }
        stopProduction(input.id);
        break;
      case "delete_post":
        deleteTaskProject(store, input.id);
        break;
      case "remove":
        stopProduction(input.id, true);
        break;
      case "resume": {
        const detail = store.get(input.id);
        if (input.step && detail.task.current_step !== input.step)
          throw new Error("현재 실행 단계가 변경되었습니다.");
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
      case "reference_account":
        addReferenceAccount(store.db,input.account);
        await refreshSpy(store.db,undefined,[accountIdentity(input.account).username]); break;
      case "remove_reference_account":
        removeReferenceAccount(store.db, input.username); break;
      case "refresh_spy":
        return Response.json(await refreshSpy(store.db));
      case "sampling_settings":
        return Response.json(saveSampling(store.db,input.settings));
      case "exclude_reference":
        setReferenceExcluded(store.db,input.id,input.excluded); break;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "처리 실패" },
      { status: 400 },
    );
  }
}
