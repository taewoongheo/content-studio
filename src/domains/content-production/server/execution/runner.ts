import type { PerformanceRefresh } from "../../domain/performance";
import { discardTask } from "../projects";
import { OPEN_DRAFT_MESSAGE } from "../../domain/start-policy";
import { readProductionSettings } from "../settings";
import { randomUUID } from "node:crypto";
import { getLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../persistence/store";
import { publishChange } from "../events";
import { refreshMetrics } from "../publication/service";
import { runCodex } from "./process";
import { resultSchema, stageImages, stagePrompt } from "./prompts";
import {
  productionResultSchema,
  type ProductionStep,
} from "../../domain/contracts";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { loadContentProject } from "@/domains/slideshow/projects/service";
import { assertEnglish } from "@/lib/text/english";

type Run = {
  controller: AbortController;
  token: string;
  step: ProductionStep;
  reviews: Map<string, { revision: number; slides: Set<string> }>;
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
export function syncState() {
  return { running: !!shared.productionSync, report: shared.productionRefresh ?? null };
}
export async function startProduction(count: number, origin: string) {
  if (!process.env.APIFY_API_TOKEN?.trim())
    throw new Error("Apify에 연결되지 않아 제작을 시작할 수 없습니다. APIFY_API_TOKEN을 설정해 주세요.");
  if (shared.productionSync)
    throw new Error("성과를 갱신하고 있습니다. 잠시 후 시작해 주세요.");
  if (!Number.isInteger(count) || count < 1)
    throw new Error("제작 개수를 양의 정수로 입력해 주세요.");
  const store = productionStore();
  if (store.hasOpenDrafts()) throw new Error(OPEN_DRAFT_MESSAGE);
  shared.productionSync = true;
  const report: PerformanceRefresh = { started_at: new Date().toISOString(), completed_at: null, state: "running", records: [], error: null };
  shared.productionRefresh = report;
  publishChange({ kind: "sync", detail: "running" });
  try {
    await refreshMetrics(store.db, undefined, undefined, records => {
      report.records = records;
      publishChange({ kind: "sync", detail: "snapshot" });
    });
    report.state = "completed";
    report.completed_at = new Date().toISOString();
    const ids = store.create(count);
    ids.forEach((id) => {
      void execute(id, origin).catch((error) => {
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
      report.error = error instanceof Error ? error.message : "성과 갱신 실패";
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
  const { model } = readProductionSettings();
  const run: Run = {
    controller: new AbortController(),
    token: randomUUID(),
    step: detail.task.current_step,
    reviews: new Map(),
  };
  runs.set(id, run);
  try {
    while (true) {
      run.controller.signal.throwIfAborted();
      run.step = store.get(id).task.current_step;
      store.state(id, "running");
      const result = await executor({
        model,
        prompt: stagePrompt(id, run.step),
        images: stageImages(run.step),
        schema: resultSchema(run.step),
        origin,
        taskId: id,
        token: run.token,
        signal: run.controller.signal,
        onActivity: (message) =>
          publishChange({
            task_id: id,
            step: run.step,
            kind: "state",
            detail: message,
          }),
      });
      run.controller.signal.throwIfAborted();
      const { sources_json, ...fields } = result;
      const sources = JSON.parse(String(sources_json));
      if (run.step === "analysis") {
        store.completeAnalysis(id, { ...fields, sources });
        continue;
      }
      const { summary_json, ...rest } = fields;
      const output = productionResultSchema.parse({
        ...rest,
        summary: JSON.parse(String(summary_json)),
        sources,
      });
      const detail = store.get(id);
      if (detail.task.project_id !== output.project_id)
        throw new Error("연결된 프로젝트와 결과가 다릅니다.");
      await loadContentProject(contentJobRegistry, output.project_id);
      const project = contentJobRegistry.get(output.project_id),
        review = run.reviews.get(output.project_id);
      const kinds = new Map(
        project.editor.document.elements.map((element) => [
          element.id,
          element.kind,
        ]),
      );
      for (const slide of project.editor.document.slides)
        for (const placement of slide.placements)
          if (kinds.get(placement.elementId) === "text")
            assertEnglish(placement.value, `slides.${slide.id}.${placement.id}`);
      if (
        project.editor.document.slides.some(
          (slide) =>
            !slide.placements.some((placement) => {
              const kind = kinds.get(placement.elementId);
              return (
                kind &&
                kind !== "background" &&
                (kind === "text" || kind === "image"
                  ? !!placement.value.trim()
                  : true)
              );
            }),
        )
      )
        throw new Error("내용이 비어 있는 슬라이드가 있습니다.");
      if (
        project.savedRevision !== project.editor.revision ||
        project.editor.revision !== output.reviewed_revision ||
        review?.revision !== output.reviewed_revision
      )
        throw new Error("최신 저장본의 이미지 검토가 필요합니다.");
      if (
        !project.editor.document.slides.every(
          (s) =>
            review.slides.has(s.id) && output.reviewed_slide_ids.includes(s.id),
        )
      )
        throw new Error("모든 슬라이드를 이미지로 검토해 주세요.");
      store.completeProduction(id, output);
      break;
    }
  } catch (error) {
    if (!run.controller.signal.aborted) {
      try {
        store.state(
          id,
          "failed",
          error instanceof Error ? error.message : "실행 실패",
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
