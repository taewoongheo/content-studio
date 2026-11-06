import { OperationError } from "@/lib/errors/operation";
import { externalReferences } from "../references/library";
import { ANALYSIS_REFERENCE_LIMIT, externalRecord } from "../../domain/references/context";
import { START_INPUT, readStartInput, startInputRecord } from "../start/context";
import { productionRequestSchema, isExternalProduction, type ProductionRequest, type PreparedSource } from "../../domain/start/input";
import type { ProductionFailure } from "../../domain/diagnostics";
import { EXTERNAL_CONTEXT, readExternalContext } from "../../domain/references/context";
import { z } from "zod";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  productionSteps,
  standaloneStepSchema,
  reviewSteps,
  analysisPatchSchema,
  analysisResultSchema,
  productionPatchSchema,
  reviewDraftPatchSchema,
  researchSchema,
  directionSchema,
  type Direction,
  type ProductionStep,
  type Row,
  type WorkItem,
  type WorkDetail,
} from "../../domain/contracts";
import { readContentMetadata, contentMetadataFields } from "@/domains/content-metadata/schema";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { publishChange } from "../events";
import { ANALYSIS_INPUTS, analysisInputRecord, readAnalysisInputs } from "./planning/input";
import { readTaskTiming, updateTaskTiming, removeTaskTiming } from "../timing";
import { readStageDocument, saveStageDocument } from "./planning/documents";
import { firstDraftPlanningSchema } from "../../domain/planning/contracts";
import type { TopicAssignment } from "../../domain/topics/model";
import { assertTaskSourcePlan } from "../projects/format/snapshot";

const directionKeys = Object.keys(directionSchema.shape) as Array<
  keyof Direction
>;
export function decode(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) =>
      key.endsWith("_json")
        ? [
            key.slice(0, -5),
            value === null ? null : JSON.parse(value as string),
          ]
        : [key, value],
    ),
  );
}
export class ProductionStore {
  constructor(readonly db: Database.Database) {}
  private now() {
    return new Date().toISOString();
  }
  private row(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).get(...args) as Row | undefined;
  }
  private update(table: string, key: string, id: string, values: Row) {
    const entries = Object.entries(values);
    if (entries.length)
      this.db
        .prepare(
          `UPDATE ${table} SET ${entries.map(([k]) => `${k}=?`).join(",")} WHERE ${key}=?`,
        )
        .run(...entries.map(([, v]) => v), id);
  }
  list(): WorkItem[] {
    return this.db
      .prepare(
        `SELECT d.*,l.topic,l.content_type FROM content_drafts d JOIN content_creation_logs l ON l.id=d.log_id ORDER BY d.created_at,d.id`,
      )
      .all() as WorkItem[];
  }
  hasOpenDrafts() {
    return !!this.row("SELECT id FROM content_drafts LIMIT 1");
  }
  get(id: string): WorkDetail {
    const task = this.list().find((row) => row.id === id);
    if (!task) throw new Error("작업이 존재하지 않거나 취소되었습니다.");
    const analysis = this.row(
      "SELECT * FROM content_analysis_drafts WHERE draft_id=?",
      id,
    )!;
    const production = this.row(
      "SELECT * FROM content_production_drafts WHERE draft_id=?",
      id,
    );
    const log = this.row(
      "SELECT * FROM content_creation_logs WHERE id=?",
      task.log_id,
    )!;
    const stage = (row: Row) => {
      const decoded = decode(row), research = decoded.research as Array<z.infer<typeof researchSchema>>;
      return { data: { ...decoded, research: research.filter(item => ![EXTERNAL_CONTEXT, ANALYSIS_INPUTS, START_INPUT].includes(item.question)) }, external: readExternalContext(research) };
    };
    const decoded = stage(analysis);
    const reviews = reviewSteps.map(step => {
      const row = this.row(`SELECT * FROM content_${step}_drafts WHERE draft_id=?`, id);
      return { step, value: row ? stage(row) : null };
    });
    return {
      input: readStartInput(JSON.parse(String(analysis.research_json))),
      analysis_inputs: (readAnalysisInputs(JSON.parse(String(analysis.research_json))) ?? []).map(({id,project_id,selection_group}) => ({id,project_id,selection_group})),
      timing: readTaskTiming(this.db, id),
      task, analysis: { ...decoded.data, ...readStageDocument(this.db, task.log_id, "analysis") },
      production: production ? { ...stage(production).data, ...readStageDocument(this.db, task.log_id, "production") } : null,
      log: decode(log),
      ...Object.fromEntries(reviews.map(({step,value}) => [step,value?.data ?? null])),
      external: { analysis: decoded.external, production: production ? stage(production).external : null, ...Object.fromEntries(reviews.map(({step,value}) => [step,value?.external ?? null])) },
    };
  }
  create(requests: number | ProductionRequest[], inputs: Row[] = [], topics: {assignments:TopicAssignment[];history:Row[]} = {assignments:[],history:[]}) {
    const entries = typeof requests === "number"
      ? Array.from({ length: requests }, () => productionRequestSchema.parse({ mode: "automatic" }))
      : requests.map(request => productionRequestSchema.parse(request));
    const references = new Map((topics.assignments.length || entries.some(request => request.mode === "spy_reference")
      ? externalReferences(this.db) : []).map(row => [String(row.id), row]));
    const sources = entries.map(request => this.requestSource(request));
    const historyById = new Map(topics.history.map(row => [String(row.id), row]));
    const ids: string[] = [];
    let automaticIndex = 0;
    this.db.transaction(() => {
      for (const [index, request] of entries.entries()) {
        const assignment = request.mode === "automatic" ? topics.assignments[automaticIndex++] : undefined;
        const referenceIds = assignment?.candidate.reference_ids ?? (request.mode === "spy_reference" ? [request.referenceId] : []);
        const external = externalRecord({checked_at:this.now(),queries:[],collection_attempted:false,
          message:"References supporting the assigned topic or explicitly selected source.",
          posts:[...new Set(referenceIds)].flatMap(id => { const row=references.get(id); return row ? [row] : []; }).slice(0,ANALYSIS_REFERENCE_LIMIT)});
        const matchedIds = new Set([...(assignment?.direct_log_ids ?? []), ...(assignment?.related_log_ids ?? [])]);
        const taskInputs = assignment ? [...matchedIds].map(matchedId => {
          const row = historyById.get(matchedId);
          if (!row) throw new Error("선정 주제에 매칭된 게시글을 찾을 수 없습니다.");
          return { ...row, selection_group: assignment.direct_log_ids.includes(matchedId) ? "direct" : "related" };
        }) : inputs;
        const origin = assignment ? (assignment.direct_log_ids.length ? "internal" as const : "spy" as const) : undefined;
        const source = origin === "spy"
          ? this.requestSource({ mode: "spy_reference", referenceId: assignment!.candidate.reference_ids[0], instructions: request.instructions })
          : sources[index];
        const id = randomUUID(),
          log = randomUUID(),
          now = this.now();
        this.db
          .prepare(
            "INSERT INTO content_creation_logs(id,created_at,updated_at) VALUES(?,?,?)",
          )
          .run(log, now, now);
        this.db
          .prepare(
            "INSERT INTO content_drafts(id,log_id,current_step,state,created_at,updated_at) VALUES(?,?,'analysis','pending',?,?)",
          )
          .run(id, log, now, now);
        this.db
          .prepare(
            "INSERT INTO content_analysis_drafts(draft_id,created_at,updated_at,research_json) VALUES(?,?,?,?)",
          )
          .run(id, now, now, JSON.stringify([external, analysisInputRecord(taskInputs), startInputRecord({ request, ...(source ? { source } : {}), ...(origin ? { origin } : {}), ...(assignment ? {topic_assignment:assignment} : {}) })]));
        if (assignment) this.db.prepare("INSERT INTO content_topic_selections(log_id,candidate_id,requested_lane,document_json) VALUES(?,?,?,?)")
          .run(log,assignment.candidate.id,assignment.requested_lane,JSON.stringify(assignment));
        ids.push(id);
      }
    })();
    publishChange({ kind: "state" });
    return ids;
  }
  requestSource(request: ProductionRequest): PreparedSource | undefined {
    if (request.mode === "spy_reference") {
      const source = this.row(`SELECT r.id,r.url,r.caption,r.title FROM content_external_references r
        JOIN content_reference_accounts a ON a.username=r.account
        WHERE r.id=? AND a.enabled=1`, request.referenceId);
      if (!source) throw new Error("선택한 스파이 게시글을 사용할 수 없습니다. 계정과 게시글의 등록 상태를 확인해 주세요.");
      return { id: String(source.id), url: String(source.url), caption: String(source.caption), name: String(source.title || source.caption || "선택한 레퍼런스") };
    }
    if (request.mode !== "past_post") return;
    const source = this.row("SELECT l.id,l.project_id,p.name FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id WHERE l.project_id=? AND l.post_url IS NOT NULL", request.sourceProjectId);
    if (!source) throw new Error("선택한 과거 게시글의 저장본을 찾을 수 없습니다.");
    return { id: String(source.id), project_id: String(source.project_id), name: String(source.name) };
  }
  savePreparedSource(id: string, source: PreparedSource) {
    const detail = this.assertActive(id, "analysis");
    const row = this.row("SELECT research_json FROM content_analysis_drafts WHERE draft_id=?", id)!;
    const research = JSON.parse(String(row.research_json)) as Row[];
    this.update("content_analysis_drafts", "draft_id", id, {
      research_json: JSON.stringify([...research.filter(row => row.question !== START_INPUT), startInputRecord({ ...detail.input!, source })]),
      updated_at: this.now(),
    });
    publishChange({ task_id: id, step: "analysis", kind: "saved" });
  }
  sourceProjectAllowed(id: string, projectId: string) {
    return this.analysisInputs(id).some(row => row.project_id === projectId)
      || this.get(id).input?.source?.project_id === projectId;
  }
  cloneSourceAllowed(id: string, projectId: string) {
    const input = this.get(id).input!;
    if (isExternalProduction(input)) return false;
    if (input.request.mode === "automatic" && input.topic_assignment)
      return this.analysisInputs(id).some(row => row.project_id === projectId
        && input.topic_assignment!.direct_log_ids.includes(String(row.id)));
    return this.sourceProjectAllowed(id, projectId);
  }
  assertActive(id: string, step: ProductionStep) {
    const detail = this.get(id);
    if (detail.task.current_step !== step || detail.task.state !== "running")
      throw new Error("현재 실행 단계에서만 저장할 수 있습니다.");
    return detail;
  }
  state(id: string, state: string, error?: string | ProductionFailure) {
    const detail = this.get(id),
      now = this.now();
    this.db.transaction(() => {
      this.update("content_drafts", "id", id, { state, updated_at: now });
      this.update(
        `content_${detail.task.current_step}_drafts`,
        "draft_id",
        id,
        {
          state: state === "finished" ? "completed" : state,
          error_json: error ? JSON.stringify(typeof error === "string" ? { message: error } : error) : null,
          updated_at: now,
        },
      );
    })();
    updateTaskTiming(this.db, id, detail.task.current_step, state === "running", now);
    publishChange({
      task_id: id,
      step: detail.task.current_step,
      kind: "state",
    });
  }
  save(id: string, step: ProductionStep, raw: unknown) {
    const detail = this.assertActive(id, step);
    const patch = (
      step === "analysis" ? analysisPatchSchema : step === "production" ? productionPatchSchema : reviewDraftPatchSchema
    ).parse(raw);
    if (step === "production" && "slide_plan" in patch && patch.slide_plan)
      assertTaskSourcePlan(detail, patch.slide_plan);
    // Collection snapshots are server-owned evidence, not agent-authored prose.
    if (patch.research) {
      patch.research = patch.research.filter(item => ![EXTERNAL_CONTEXT, ANALYSIS_INPUTS, START_INPUT].includes(item.question));
    }
    if (patch.research) {
      const row = this.row(`SELECT research_json FROM content_${step}_drafts WHERE draft_id=?`, id)!;
      const existing = JSON.parse(String(row.research_json)) as Array<z.infer<typeof researchSchema>>;
      patch.research = [...existing.filter(item => [EXTERNAL_CONTEXT, ANALYSIS_INPUTS, START_INPUT].includes(item.question)), ...patch.research];
    }
    const values: Row = { updated_at: this.now() }, document: Row = {};
    for (const [key, value] of Object.entries(patch)) {
      if (["reasoning", "readiness", "slide_plan", "content_review"].includes(key)) {
        document[key] = value;
        continue;
      }
      values[typeof value === "object" ? `${key}_json` : key] =
        typeof value === "object" ? JSON.stringify(value) : value;
    }
    if (
      step === "production" &&
      "content" in patch &&
      patch.content &&
      Object.keys(patch.content).length
    ) {
      const previous = this.get(id).production;
      if (!previous?.draft_saved_at) values.draft_saved_at = this.now();
    }
    this.db.transaction(() => {
      saveStageDocument(this.db, detail.task.log_id, step, document);
      this.update(`content_${step}_drafts`, "draft_id", id, values);
      this.update("content_drafts", "id", id, {
        updated_at: values.updated_at,
      });
    })();
    publishChange({ task_id: id, step, kind: "saved" });
    return this.get(id);
  }
  prepareNodeRun(id: string, rawStep: unknown) {
    const step = standaloneStepSchema.parse(rawStep), detail = this.get(id), now = this.now();
    if (detail.task.state === "running" || detail.task.state === "pending") throw new Error("진행 중인 작업은 노드를 다시 실행할 수 없습니다.");
    if (detail.log.post_url) throw new Error("게시된 콘텐츠는 노드를 다시 실행할 수 없습니다.");
    if (step !== "analysis" && (!detail.task.project_id || !detail[step])) throw new Error("해당 단계까지 제작된 draft가 필요합니다.");
    this.db.transaction(()=>{
      this.update("content_drafts","id",id,{current_step:step,state:"stopped",updated_at:now});
      this.update(`content_${step}_drafts`,"draft_id",id,{state:"stopped",error_json:null,completed_at:null,updated_at:now});
    })();
    publishChange({task_id:id,step,kind:"state"});
  }
  completeAnalysis(id: string, raw: unknown, validateOnly = false, singleStage = false) {
    const detail = this.assertActive(id, "analysis"),
      result = analysisResultSchema.parse(raw),
      now = this.now();
    if (!result.readiness.ready)
      throw new OperationError("ANALYSIS_NOT_READY", "제작 가능한 계획을 확정한 뒤 계속 진행해 주세요.", { readiness: result.readiness });
    if (validateOnly) return;
    this.db.transaction(() => {
      saveStageDocument(this.db, detail.task.log_id, "analysis", { reasoning: result.reasoning, readiness: result.readiness });
      const values: Row = {
        analysis: result.analysis,
        sources_json: JSON.stringify(result.sources),
        updated_at: now,
      };
      for (const key of directionKeys) values[key] = result[key];
      this.update("content_creation_logs", "id", detail.task.log_id, values);
      this.update("content_analysis_drafts", "draft_id", id, {
        ...values,
        state: "completed",
        completed_at: now,
      });
      if (!singleStage) this.db
        .prepare(
          "INSERT INTO content_production_drafts(draft_id,created_at,updated_at) VALUES(?,?,?)",
        )
        .run(id, now, now);
      this.update("content_drafts", "id", id, {
        current_step: singleStage ? "analysis" : "production",
        state: singleStage ? "finished" : "pending",
        updated_at: now,
      });
    })();
    updateTaskTiming(this.db, id, "analysis", false, now);
    publishChange({ task_id: id, step: "analysis", kind: "saved" });
    return this.get(id);
  }
  completeProduction(
    id: string,
    result: { project_id: string; summary: Row; sources: unknown[]; review?: string; slide_plan?: unknown; content_review?: unknown; layout_checks?: unknown },
    validateOnly = false,
    singleStage = false,
  ) {
    const step = this.get(id).task.current_step;
    if (step === "analysis") throw new Error("분석 단계는 제작 완료로 저장할 수 없습니다.");
    const detail = this.assertActive(id, step),
      now = this.now();
    const planning = step === "production" ? firstDraftPlanningSchema.parse({
      slide_plan: result.slide_plan, content_review: result.content_review,
    }) : null;
    if (planning?.content_review.issues.some(issue => issue.status === "blocked"))
      throw new OperationError("CONTENT_REVIEW_BLOCKED", "초안의 내용 검토에서 확인한 문제를 해결해 주세요.", { issues: planning.content_review.issues });
    const next = singleStage ? null : productionSteps[productionSteps.findIndex(value => value.id === step) + 1]?.id ?? null;
    if (step !== "production" && !result.review?.trim()) throw new Error("검토 결과를 남겨 주세요.");
    const metadata = readContentMetadata(result.summary);
    // The format is selected by analysis; a model paraphrase must not block completion.
    if (["automatic", "past_post"].includes(detail.input?.request.mode ?? ""))
      metadata.content_type = String(detail.analysis.content_type);
    this.assertRequestDirection(detail, metadata);
    if (detail.task.project_id !== result.project_id)
      throw new Error("이 작업의 프로젝트만 완료할 수 있습니다.");
    if (validateOnly) return;
    this.db.transaction(() => {
      if (planning) saveStageDocument(this.db, detail.task.log_id, step, planning);
      if (detail.task.project_id !== result.project_id)
        throw new Error("이 작업의 프로젝트만 완료할 수 있습니다.");
      new ContentProjectStore(this.db).updateMetadata(result.project_id, metadata);
      const sources = [...(detail.log.sources as unknown[]), ...result.sources];
      const summary = {
        ...result.summary,
        ...metadata,
        ...(step === "visual" ? {layout_checks:result.layout_checks} : {}),
        direction_changes: detail.production?.direction_changes ?? null,
      };
      this.update("content_creation_logs", "id", detail.task.log_id, {
        ...metadata,
        content_summary_json: JSON.stringify(summary),
        sources_json: JSON.stringify(sources),
        updated_at: now,
      });
      this.update(`content_${step}_drafts`, "draft_id", id, {
        state: "completed",
        content_json: JSON.stringify(summary),
        sources_json: JSON.stringify(result.sources),
        ...(step !== "production" ? { review: result.review } : {}),
        completed_at: now,
        updated_at: now,
      });
      if (next) this.db.prepare(
        `INSERT INTO content_${next}_drafts(draft_id,created_at,updated_at) VALUES(?,?,?)`,
      ).run(id, now, now);
      this.update("content_drafts", "id", id, {
        current_step: next ?? step,
        state: next ? "pending" : "finished",
        updated_at: now,
      });
    })();
    updateTaskTiming(this.db, id, step, false, now);
    publishChange({ task_id: id, step, kind: "saved" });
  }
  private assertRequestDirection(detail: WorkDetail, direction: Row) {
    if (detail.input && (detail.input.request.mode === "automatic" || !isExternalProduction(detail.input)) && detail.analysis.content_type && direction.content_type !== detail.analysis.content_type)
      throw new Error("원본 구성 기반 제작에서는 확정한 표현 포맷을 유지해 주세요.");
    if (detail.input && detail.input.request.mode !== "automatic" && isExternalProduction(detail.input) && direction.topic !== detail.analysis.topic)
      throw new Error("외부 URL 기반 제작에서는 확정한 원본 소재를 유지해 주세요.");
  }
  changeDirection(
    id: string,
    raw: unknown,
    cause: "collision" | "source_fit" | "research",
    reason?: string,
  ) {
    const detail = this.assertActive(id, this.get(id).task.current_step),
      direction = directionSchema.parse(raw),
      now = this.now();
    if (cause === "source_fit" && (!reason?.trim() || detail.input?.request.mode !== "automatic" || !["analysis", "production"].includes(detail.task.current_step)))
      throw new Error("구성에 맞는 주제 수정은 자동 분석·초안에서 이유와 함께 진행해 주세요.");
    if (cause === "collision" && detail.input?.request.mode !== "automatic") throw new Error("지정 제작에는 중복 검사를 적용하지 않습니다.");
    if (cause === "collision" && !["analysis", "production"].includes(detail.task.current_step))
      throw new Error("중복 재선정은 분석·초안에서 완료해 주세요. 후속 단계에서는 현재 내용을 직접 수정해 주세요.");
    this.assertRequestDirection(detail, direction);
    if (cause === "research" && !reason?.trim())
      throw new Error("추가 조사에 따른 변경 이유가 필요합니다.");
    this.db.transaction(() => {
      if (cause === "collision" || cause === "source_fit") {
        this.db.prepare("DELETE FROM content_stage_documents WHERE log_id=? AND step='production'").run(detail.task.log_id);
        this.update("content_analysis_drafts", "draft_id", id, {
          ...direction,
          updated_at: now,
        });
        this.update("content_creation_logs", "id", detail.task.log_id, {
          ...direction,
          updated_at: now,
        });
        this.update("content_production_drafts", "draft_id", id, {
          content_json: null,
          draft_saved_at: null,
          direction_changes: null,
          updated_at: now,
        });
      } else {
        const changes = [
          detail.production?.direction_changes,
          JSON.stringify({ reason, direction }),
        ]
          .filter(Boolean)
          .join("\n");
        this.update("content_production_drafts", "draft_id", id, {
          direction_changes: changes,
          updated_at: now,
        });
      }
    })();
    publishChange({ task_id: id, step: "production", kind: "saved" });
  }
  remove(id: string) {
    const detail = this.get(id);
    this.db.transaction(() => {
      this.db.prepare("DELETE FROM content_drafts WHERE id=?").run(id);
      this.db.prepare("DELETE FROM content_creation_logs WHERE id=? AND project_id IS NULL AND post_url IS NULL").run(detail.task.log_id);
    })();
    removeTaskTiming(this.db, id);
    publishChange({ task_id: id, kind: "removed" });
  }
  recover() {
    for (const task of this.list())
      if (task.state === "running" || task.state === "pending")
        this.state(task.id, "stopped");
  }
  logs(query = "", publishedOnly = false) {
    return (
      this.db
        .prepare(
          `SELECT l.*,COALESCE(l.project_id,d.project_id) AS project_id,p.name FROM content_creation_logs l LEFT JOIN content_drafts d ON d.log_id=l.id LEFT JOIN content_projects p ON p.id=COALESCE(l.project_id,d.project_id) WHERE (l.project_id IS NOT NULL OR EXISTS(SELECT 1 FROM content_drafts d WHERE d.log_id=l.id)) ${publishedOnly ? "AND l.post_url IS NOT NULL" : ""} AND (COALESCE(l.topic,'') LIKE ? OR COALESCE(p.name,'') LIKE ? OR COALESCE(l.message,'') LIKE ? OR COALESCE(l.content_type,'') LIKE ?) ORDER BY l.created_at DESC`,
        )
        .all(...Array(4).fill(`%${query}%`)) as Row[]
    ).map(decode);
  }
  comparisons() {
    const since = new Date(Date.now() - 86400000).toISOString();
    return {
      drafts: this.list().map((t) => this.get(t.id)),
      published: this.logs().filter(
        (l) =>
          typeof l.actual_published_at === "string" &&
          l.actual_published_at >= since,
      ),
    };
  }
  analysisInputs(id: string, initialize = false): Row[] {
    const row = this.row("SELECT research_json FROM content_analysis_drafts WHERE draft_id=?", id);
    if (!row) throw new Error("분석 draft를 찾을 수 없습니다.");
    const research = JSON.parse(String(row.research_json)) as Row[];
    const existing = readAnalysisInputs(research);
    if (existing) return existing;
    if (!initialize) return [];
    // Never refill a retained draft with unrelated performance/recent samples.
    const record = analysisInputRecord([]);
    this.db.prepare("UPDATE content_analysis_drafts SET research_json=? WHERE draft_id=?")
      .run(JSON.stringify([...research, record]), id);
    return readAnalysisInputs([record])!;
  }
  analysisLogs(id: string, ids: string[]): Row[] {
    const assigned = this.analysisInputs(id);
    if (!ids.length || ids.some(id => !assigned.some(row => row.id === id)))
      throw new Error("전달된 분석 게시글 ID만 조회할 수 있습니다.");
    return [...new Set(ids)].map(logId => {
      const row = this.row("SELECT l.*,p.name FROM content_creation_logs l JOIN content_projects p ON p.id=l.project_id WHERE l.id=?", logId);
      if (!row) throw new Error(`분석 게시글을 찾을 수 없습니다: ${logId}`);
      return {...decode(row), ...assigned.find(row => row.id === logId)};
    });
  }
  editLog(id: string, raw: unknown) {
    const nullableText = z
      .string()
      .trim()
      .transform((value) => value || null)
      .nullable()
      .optional();
    const patch = z
      .object(
        Object.fromEntries(
          ["analysis", ...directionKeys].map((key) => [key, nullableText]),
        ),
      )
      .strict()
      .parse(raw);
    const log = this.row("SELECT project_id FROM content_creation_logs WHERE id=?", id);
    if (!log) throw new Error("로그를 찾을 수 없습니다.");
    this.db.transaction(() => {
      if (log.project_id && contentMetadataFields.some(key => key in patch)) {
        const projects = new ContentProjectStore(this.db);
        const project = projects.getSummary(String(log.project_id));
        if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
        const metadata = readContentMetadata({ ...project, ...patch });
        projects.updateMetadata(project.id, metadata);
      }
      this.update("content_creation_logs", "id", id, { ...patch, updated_at: this.now() });
    })();
    publishChange({ kind: "library" });
  }
}
