import type { EditorDocument } from "@/domains/slideshow/editor/types";
import type { WorkDetail } from "../../../domain/contracts";
import { OperationError } from "@/lib/errors/operation";
import { assertSourceStructure } from "./structure";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import type { ProductionStore } from "../../persistence/store";
import type { slidePlanSchema } from "../../../domain/planning/contracts";
import type { z } from "zod";

export interface SourceFormat {
  project_id: string;
  document: EditorDocument;
}

/** Reuse the frozen origin for repairs; only older drafts need a live-source fallback. */
export function sourceDocument(store: ProductionStore, detail: WorkDetail): EditorDocument | null {
  const snapshot = detail.analysis.source_format as SourceFormat | undefined;
  if (snapshot) return snapshot.document;
  const sourceId = (detail.analysis.sources as Array<{ clone_project_id?: string }> | undefined)
    ?.find(source => source.clone_project_id)?.clone_project_id ?? detail.input?.source?.project_id;
  if (!sourceId) return null;
  const saved = new ContentProjectStore(store.db).get(sourceId);
  if (!saved) throw new OperationError("LAYOUT_SOURCE_MISSING", "확정된 원본 프로젝트를 찾을 수 없습니다.");
  return saved.document as EditorDocument;
}

function requiredFormat(detail: WorkDetail) {
  const mode = detail.input?.request.mode;
  if (mode !== "automatic" && mode !== "past_post") return;
  const snapshot = detail.analysis.source_format as SourceFormat | undefined;
  if (!snapshot)
    throw new OperationError("SOURCE_FORMAT_MISSING", "production_clone_project로 확정된 원본 구성을 확인해 주세요. 기존 초안은 유지됩니다.");
  return snapshot;
}

/** Catch an invented page sequence before the agent starts expensive image generation. */
export function assertTaskSourcePlan(detail: WorkDetail, plan: z.infer<typeof slidePlanSchema>) {
  const source = requiredFormat(detail);
  if (!source) return;
  const slides = source.document.slides;
  if (slides.length !== plan.length || slides.some((slide, index) =>
    slide.id !== plan[index].slide_id || slide.role !== plan[index].role))
    throw new OperationError("SOURCE_PLAN_MISMATCH", "이미지 생성 전에 장별 계획을 원본 장 수·순서·역할에 맞춰 주세요.", {
      expected: slides.map(slide => ({ slide_id: slide.id, role: slide.role })),
    });
}

export function assertTaskSourceFormat(detail: WorkDetail, document: EditorDocument) {
  const snapshot = requiredFormat(detail);
  if (snapshot) assertSourceStructure(snapshot.document, document);
}
