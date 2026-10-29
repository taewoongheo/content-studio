import { refreshSpy } from "../references/spy/refresh";
import { readSampling } from "../settings/sampling";
import { readPlanningLogs } from "../persistence/planning/logs";
import { productionRequestsSchema, type ProductionRequest } from "../../domain/start/input";
import { prepareStartInput } from "../start/prepare";
import { activeProduct } from "../products/store";
import { readPersona } from "../persona/store";
import { assertCompleteProjectReview, assertCurrentSlidePlan, type ObservedReview } from "./review/validation";
import type { ToolAttempt } from "../../domain/diagnostics";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OperationError } from "@/lib/errors/operation";
import { productionFailure, requiredToolFailure } from "./diagnostics/failure";
import { beginToolCall, finishToolCall } from "./diagnostics/tools";
import { z } from "zod";
import type { PerformanceRefresh } from "../../domain/performance";
import { discardTask } from "../projects";
import { OPEN_DRAFT_MESSAGE } from "../../domain/start-policy";
import { randomUUID } from "node:crypto";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../persistence/store";
import { publishChange } from "../events";
import { refreshMetrics } from "../publication/service";
import { runCodex } from "./process";
import { stagePolicy, PRODUCTION_MODEL } from "./policy/stages";
import { resultSchema, stageImages, stagePrompt } from "./prompts";
import {
  productionResultSchema,
  firstDraftResultSchema,
  sourceSchema,
  type ProductionStep,
} from "../../domain/contracts";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { loadContentProject } from "@/domains/slideshow/projects/service";

type Run = {
  controller: AbortController;
  token: string;
  step: ProductionStep;
  analysisRead: Set<string>;
  sourceImages: boolean;
  sourceProjects: Set<string>;
  sourceSets: Set<string>;
  externalCompared: boolean;
  toolCalls: ToolAttempt[];
  imageStartedAt: number;
  imageThreadId: string | null;
  reviews: Map<string, ObservedReview>;
};
const shared = globalThis as typeof globalThis & {
  productionRuns?: Map<string, Run>;
  productionRecovered?: boolean;
  productionSync?: boolean;
  productionRefresh?: PerformanceRefresh;
};
const runs = (shared.productionRuns ??= new Map<string, Run>());
export function productionStore() {
  const store = new ProductionStore(getLocalDatabase());
  if (!shared.productionRecovered) {
    store.recover();
    shared.productionRecovered = true;
  }
  return store;
}
export function authorizeRun(id: string, token: string | null) {
  const run = runs.get(id);
  if (
    !run ||
    !token ||
    token !== `Bearer ${run.token}` ||
    run.controller.signal.aborted
  )
    throw new Error("실행 권한이 만료되었습니다.");
  productionStore().assertActive(id, run.step);
  return run;
}
export function recordReview(
  id: string,
  projectId: string,
  revision: number,
  slides: string[],
) {
  const run = runs.get(id);
  if (!run) return;
  const previous = run.reviews.get(projectId);
  const reviewed =
    previous?.revision === revision ? previous.slides : new Set<string>();
  slides.forEach((s) => reviewed.add(s));
  run.reviews.set(projectId, { revision, slides: reviewed });
}
export function recordSourceReview(id: string, projectId?: string, setId?: string, indexes?: number[]) {
  const run = runs.get(id);
  if (run) { run.sourceImages = true; if (projectId) run.sourceProjects.add(projectId); if (setId && indexes === undefined) run.sourceSets.add(setId); }
}
export function recordAnalysisRead(id: string, ids: string[]) {
  const run = runs.get(id);
  if (run?.step === "analysis") {
    run.analysisRead ??= new Set();
    ids.forEach(id => run.analysisRead.add(id));
  }
}
export function recordExternalComparison(id: string) {
  const run = runs.get(id);
  if (run) run.externalCompared = true;
}
export function recordToolCall(id: string, event: {callId: string; name: string; input: unknown; result?: CallToolResult}) {
  const run = runs.get(id);
  if (!run) return;
  if (!event.result) run.toolCalls.push(beginToolCall(event.callId, event.name, event.input));
  else {
    const attempt = run.toolCalls.find(call => call.call_id === event.callId);
    if (attempt) { finishToolCall(attempt, event.result); if (attempt.message) attempt.message = attempt.message.replaceAll(run.token, "[redacted]"); }
  }
}
export function imageExecution(id: string) {
  const run = runs.get(id);
  if (!run || run.step !== "production" || run.controller.signal.aborted) throw new Error("이미지는 실행 중인 초안 제작 단계에서만 가져올 수 있습니다.");
  if (!run.imageThreadId || !/^[a-zA-Z0-9-]+$/.test(run.imageThreadId))
    throw new OperationError("IMAGE_EXECUTION_NOT_READY", "현재 CLI 실행의 이미지 출력 위치가 아직 확인되지 않았습니다.");
  return {startedAt:run.imageStartedAt,threadId:run.imageThreadId};
}
export function syncState() {
  return { running: !!shared.productionSync, report: shared.productionRefresh ?? null };
}
export async function startProduction(
  count: number | ProductionRequest[], origin: string,
  services: {refreshMetrics: typeof refreshMetrics;execute: typeof execute;refreshSpy?: typeof refreshSpy} = { refreshMetrics, execute, refreshSpy },
) {
  if (!process.env.APIFY_API_TOKEN?.trim())
    throw new Error("Apify에 연결되지 않아 제작을 시작할 수 없습니다. APIFY_API_TOKEN을 설정해 주세요.");
  if (shared.productionSync)
    throw new Error("성과를 갱신하고 있습니다. 잠시 후 시작해 주세요.");
  if (typeof count === "number" && (!Number.isInteger(count) || count < 1))
    throw new Error("제작 개수를 양의 정수로 입력해 주세요.");
  const requests = productionRequestsSchema.parse(typeof count === "number"
    ? Array.from({ length: count }, () => ({ mode: "automatic" })) : count);
  const store = productionStore();
  if (store.hasOpenDrafts()) throw new Error(OPEN_DRAFT_MESSAGE);
  requests.forEach(request => store.requestSource(request));
  const sampling = readSampling(store.db);
  shared.productionSync = true;
  const report: PerformanceRefresh = { started_at: new Date().toISOString(), completed_at: null, state: "running", records: [], error: null };
  shared.productionRefresh = report;
  publishChange({ kind: "sync", detail: "running" });
  try {
    await services.refreshMetrics(store.db, undefined, undefined, records => {
      report.records = records;
      publishChange({ kind: "sync", detail: "snapshot" });
    });
    await (services.refreshSpy ?? refreshSpy)(store.db);
    const inputs = readPlanningLogs(store.db,"",sampling.internalCandidates);
    const ids = store.create(requests, inputs, sampling);
    report.state = "completed";
    report.completed_at = new Date().toISOString();
    ids.forEach((id) => {
      void services.execute(id, origin).catch((error) => {
        try {
          store.state(
            id,
            "failed",
            error instanceof Error ? error.message : "실행 실패",
          );
        } catch {}
      });
    });
    return ids;
  } catch (error) {
    if (report.state === "running") {
      report.state = "failed";
      report.error = error instanceof Error ? error.message : "분석 자료 수집 실패";
      report.completed_at = new Date().toISOString();
    }
    throw error;
  } finally {
    shared.productionSync = false;
    publishChange({ kind: "sync", detail: "idle" });
  }
}
export async function execute(
  id: string,
  origin: string,
  executor: typeof runCodex = runCodex,
) {
  if (runs.has(id)) throw new Error("이미 실행 중인 작업입니다.");
  const store = productionStore(),
    detail = store.get(id);
  if (detail.task.state === "finished")
    throw new Error("제작이 끝난 작업입니다.");
  const persona = readPersona(store.db), product = activeProduct(store.db);
  const run: Run = {
    controller: new AbortController(),
    token: randomUUID(),
    step: detail.task.current_step,
    reviews: new Map(),
    analysisRead: new Set(),
    sourceImages: false,
    sourceProjects: new Set(),
    sourceSets: new Set(),
    externalCompared: false,
    toolCalls: [],
    imageStartedAt: Date.now(),
    imageThreadId: null,
  };
  runs.set(id, run);
  let phase = "cli";
  try {
    while (true) {
      run.controller.signal.throwIfAborted();
      run.step = store.get(id).task.current_step;
      store.state(id, "running");
      run.reviews.clear();
      run.analysisRead.clear();
      run.sourceImages = false;
      run.sourceProjects.clear();
      run.sourceSets.clear();
      run.externalCompared = false;
      run.toolCalls = [];
      run.imageStartedAt = Date.now();
      run.imageThreadId = null;
      phase = "source_collection";
      if (run.step === "analysis" && ["external_url", "spy_reference"].includes(store.get(id).input!.request.mode))
        await prepareStartInput(store, id, run.controller.signal);
      phase = "cli";
      const inputs = run.step === "analysis" || run.step === "production" ? store.analysisInputs(id, true) : [];
      const startInput = store.get(id).input!;
      const capabilities = stagePolicy(run.step, startInput.request.mode);
      const result = await executor({
        capabilities,
        onThreadStarted: threadId => { run.imageThreadId = threadId; },
        model: PRODUCTION_MODEL,
        prompt: stagePrompt(id, run.step, inputs, persona, product, startInput),
        images: stageImages(run.step),
        schema: resultSchema(run.step),
        origin,
        taskId: id,
        token: run.token,
        signal: run.controller.signal,
        onToolActivity: event => recordToolCall(id, event),
        onActivity: (message) =>
          publishChange({
            task_id: id,
            step: run.step,
            kind: "state",
            detail: message,
          }),
      });
      run.controller.signal.throwIfAborted();
      phase = "output";
      const { sources: rawSources, ...fields } = result;
      const sources = z.array(sourceSchema).parse(
        z.array(z.record(z.string(), z.unknown())).parse(rawSources).map(source =>
          Object.fromEntries(Object.entries(source).filter(([key, value]) =>
            !(["id", "url", "visual_set_id"].includes(key) && value === null)))),
      );
      if (run.step === "analysis") {
        phase = "validation";
        const missingInputs = inputs.filter(row => !run.analysisRead.has(String(row.id))).map(row => row.id);
        if (missingInputs.length) throw new OperationError("ANALYSIS_INPUTS_NOT_READ", "분석용 게시글 조회가 누락됐습니다.", {ids:missingInputs});
        if (startInput.request.mode === "past_post" && !run.sourceProjects.has(startInput.request.sourceProjectId))
          throw new OperationError("START_SOURCE_NOT_REVIEWED", "선택한 원본 게시글의 실제 슬라이드를 확인해 주세요.");
        if ((startInput.request.mode === "external_url" || startInput.request.mode === "spy_reference") && !run.sourceSets.has(startInput.source?.visual_set_id ?? ""))
          throw new OperationError("START_SOURCE_NOT_REVIEWED", "외부 원본 게시글의 전체 슬라이드를 확인해 주세요.");
        if (!run.externalCompared) throw requiredToolFailure(run.toolCalls, ["production_external_references"], "외부 레퍼런스 조회가 확인되지 않았습니다.");
        phase = "save";
        store.completeAnalysis(id, { ...fields, sources });
        continue;
      }
      if (startInput.request.mode === "spy_reference" && (run.step === "production" || run.step === "visual") &&
          !run.sourceSets.has(startInput.source?.visual_set_id ?? ""))
        throw new OperationError("START_SOURCE_NOT_REVIEWED", "선택한 레퍼런스의 실제 슬라이드를 확인해 주세요.");
      const { review: reviewText, review_passed, ...rest } = fields;
      if (run.step !== "production") {
        z.object({review:z.string(),review_passed:z.boolean()}).parse(fields);
        phase = "save";
        store.save(id, run.step, { review: reviewText, sources });
        phase = "validation";
        if (review_passed !== true || typeof reviewText !== "string" || !reviewText.trim())
          throw new OperationError("REVIEW_REJECTED", "검토를 통과하지 못했습니다. 검토 결과를 확인해 주세요.", {
            review: reviewText, review_passed,
          });
        if (run.step === "visual" && sources.length)
          throw new OperationError("VISUAL_REFERENCES_FORBIDDEN", "시각 검증에서는 레퍼런스를 조회하거나 출처로 기록하지 않습니다.");
        if (run.step === "hook" && !run.sourceImages)
          throw requiredToolFailure(run.toolCalls, ["production_preview_project", "production_read_images"], "참고 게시글의 실제 이미지 확인이 필요합니다.");
      }
      phase = "output";
      const rawOutput = { ...rest, sources };
      const firstDraft = run.step === "production" ? firstDraftResultSchema.parse(rawOutput) : null;
      const output = firstDraft ?? productionResultSchema.parse(rawOutput);
      phase = "validation";
      const detail = store.get(id);
      if (detail.task.project_id !== output.project_id)
        throw new OperationError("PROJECT_RESULT_MISMATCH", "연결된 프로젝트와 결과가 다릅니다.");
      await loadContentProject(contentJobRegistry, output.project_id);
      if (firstDraft)
        assertCurrentSlidePlan(contentJobRegistry.getRecord(output.project_id), firstDraft.slide_plan);
      assertCompleteProjectReview(
        contentJobRegistry.getRecord(output.project_id), output,
        run.reviews.get(output.project_id), run.toolCalls,
      );
      phase = "save";
      store.completeProduction(id, { ...output, review: typeof reviewText === "string" ? reviewText : undefined });
      if (store.get(id).task.state === "finished") break;
    }
  } catch (error) {
    if (!run.controller.signal.aborted) {
      try {
        store.state(
          id,
          "failed",
          productionFailure(error, run.step, phase, run.toolCalls),
        );
      } catch {}
    }
  } finally {
    if (runs.get(id) === run) runs.delete(id);
  }
}
export function stopProduction(id: string, remove = false) {
  const store = productionStore();
  store.get(id);
  const run = runs.get(id);
  if (run) {
    run.controller.abort(new Error("사용자가 중단했습니다."));
    runs.delete(id);
  }
  if (remove) discardTask(store, id);
  else store.state(id, "stopped");
}

export function resetProduction() {
  if (shared.productionSync)
    throw new Error("성과 갱신 중에는 초기화할 수 없습니다. 갱신이 끝난 뒤 다시 시도해 주세요.");
  const store = productionStore();
  const tasks = store.list();
  for (const task of tasks)
    if (runs.has(task.id) || task.state === "running" || task.state === "pending")
      stopProduction(task.id);
  contentJobRegistry.transaction(() => store.db.transaction(() => {
    for (const task of tasks) discardTask(store, task.id);
  })());
  shared.productionRefresh = undefined;
  publishChange({ kind: "reset" });
}
