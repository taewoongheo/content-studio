import type { ProductionFailure } from "../../domain/diagnostics";
import { EXTERNAL_CONTEXT, readExternalContext } from "../../domain/references/context";
import { z } from "zod";
import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  productionSteps,
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
import { readPlanningLogs } from "./planning/logs";

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
      return { data: { ...decoded, research: research.filter(item => ![EXTERNAL_CONTEXT, ANALYSIS_INPUTS].includes(item.question)) }, external: readExternalContext(research) };
    };
    const decoded = stage(analysis);
    const reviews = reviewSteps.map(step => {
      const row = this.row(`SELECT * FROM content_${step}_drafts WHERE draft_id=?`, id);
      return { step, value: row ? stage(row) : null };
    });
    return {
      analysis_inputs: (readAnalysisInputs(JSON.parse(String(analysis.research_json))) ?? []).map(({id,project_id,selection_group}) => ({id,project_id,selection_group})),
      task, analysis: decoded.data, production: production ? stage(production).data : null, log: decode(log),
      ...Object.fromEntries(reviews.map(({step,value}) => [step,value?.data ?? null])),
      external: { analysis: decoded.external, production: production ? stage(production).external : null, ...Object.fromEntries(reviews.map(({step,value}) => [step,value?.external ?? null])) },
    };
  }
  create(count: number, inputs = this.planningLogs()) {
    const ids: string[] = [];
    this.db.transaction(() => {
      for (let i = 0; i < count; i++) {
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
          .run(id, now, now, JSON.stringify([analysisInputRecord(inputs)]));
        ids.push(id);
      }
    })();
    publishChange({ kind: "state" });
    return ids;
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
    publishChange({
      task_id: id,
      step: detail.task.current_step,
      kind: "state",
    });
  }
  save(id: string, step: ProductionStep, raw: unknown) {
    this.assertActive(id, step);
    const patch = (
      step === "analysis" ? analysisPatchSchema : step === "production" ? productionPatchSchema : reviewDraftPatchSchema
    ).parse(raw);
    // Collection snapshots are server-owned evidence, not agent-authored prose.
    if (patch.research) {
      patch.research = patch.research.filter(item => ![EXTERNAL_CONTEXT, ANALYSIS_INPUTS].includes(item.question));
    }
    if (patch.research) {
      const row = this.row(`SELECT research_json FROM content_${step}_drafts WHERE draft_id=?`, id)!;
      const existing = JSON.parse(String(row.research_json)) as Array<z.infer<typeof researchSchema>>;
      patch.research = [...existing.filter(item => [EXTERNAL_CONTEXT, ANALYSIS_INPUTS].includes(item.question)), ...patch.research];
    }
    const values: Row = { updated_at: this.now() };
    for (const [key, value] of Object.entries(patch))
      values[typeof value === "object" ? `${key}_json` : key] =
        typeof value === "object" ? JSON.stringify(value) : value;
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
      this.update(`content_${step}_drafts`, "draft_id", id, values);
      this.update("content_drafts", "id", id, {
        updated_at: values.updated_at,
      });
    })();
    publishChange({ task_id: id, step, kind: "saved" });
    return this.get(id);
  }
  completeAnalysis(id: string, raw: unknown) {
    const detail = this.assertActive(id, "analysis"),
      result = analysisResultSchema.parse(raw),
      now = this.now();
    this.db.transaction(() => {
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
      this.db
        .prepare(
          "INSERT INTO content_production_drafts(draft_id,created_at,updated_at) VALUES(?,?,?)",
        )
        .run(id, now, now);
      this.update("content_drafts", "id", id, {
        current_step: "production",
        state: "pending",
        updated_at: now,
      });
    })();
    publishChange({ task_id: id, step: "analysis", kind: "saved" });
    return this.get(id);
  }
  completeProduction(
    id: string,
    result: { project_id: string; summary: Row; sources: unknown[]; review?: string },
  ) {
    const step = this.get(id).task.current_step;
    if (step === "analysis") throw new Error("분석 단계는 제작 완료로 저장할 수 없습니다.");
    const detail = this.assertActive(id, step),
      now = this.now();
    const next = productionSteps[productionSteps.findIndex(value => value.id === step) + 1]?.id ?? null;
    if (step !== "production" && !result.review?.trim()) throw new Error("검토 결과를 남겨 주세요.");
    const metadata = readContentMetadata(result.summary);
    if (step === "polish" && contentMetadataFields.some(key => metadata[key] !== detail.log[key]))
      throw new Error("영어 폴리싱에서는 확정한 소재·메시지·포맷을 변경할 수 없습니다.");
    this.db.transaction(() => {
      if (detail.task.project_id !== result.project_id)
        throw new Error("이 작업의 프로젝트만 완료할 수 있습니다.");
      new ContentProjectStore(this.db).updateMetadata(result.project_id, metadata);
      const sources = [...(detail.log.sources as unknown[]), ...result.sources];
      const summary = {
        ...result.summary,
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
        content_json: JSON.stringify(result.summary),
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
    publishChange({ task_id: id, step, kind: "saved" });
  }
  changeDirection(
    id: string,
    raw: unknown,
    cause: "collision" | "research",
    reason?: string,
  ) {
    const detail = this.assertActive(id, "production"),
      direction = directionSchema.parse(raw),
      now = this.now();
    if (cause === "research" && !reason?.trim())
      throw new Error("추가 조사에 따른 변경 이유가 필요합니다.");
    this.db.transaction(() => {
      if (cause === "collision") {
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
          `SELECT l.*,COALESCE(l.project_id,d.project_id) AS project_id,p.name FROM content_creation_logs l LEFT JOIN content_drafts d ON d.log_id=l.id LEFT JOIN content_projects p ON p.id=COALESCE(l.project_id,d.project_id) WHERE (l.project_id IS NOT NULL OR EXISTS(SELECT 1 FROM content_drafts d WHERE d.log_id=l.id)) ${publishedOnly ? "AND l.post_url IS NOT NULL" : ""} AND (COALESCE(l.topic,'') LIKE ? OR COALESCE(p.name,'') LIKE ?) ORDER BY l.created_at DESC`,
        )
        .all(`%${query}%`, `%${query}%`) as Row[]
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
    // Older retained drafts receive a comparison set once, on their first resume.
    const record = analysisInputRecord(this.planningLogs());
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
  planningLogs(query = "") {
    return readPlanningLogs(this.db, query).map(decode);
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
