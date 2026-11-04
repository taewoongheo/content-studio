import type { EditorDocument } from "@/domains/slideshow/editor/types";
import type { WorkDetail } from "../../../domain/contracts";
import { OperationError } from "@/lib/errors/operation";
import { assertSourceStructure } from "./structure";

export interface SourceFormat {
  project_id: string;
  document: EditorDocument;
}

export function assertTaskSourceFormat(detail: WorkDetail, document: EditorDocument) {
  const mode = detail.input?.request.mode;
  if (mode !== "automatic" && mode !== "past_post") return;
  const snapshot = detail.analysis.source_format as SourceFormat | undefined;
  if (!snapshot)
    throw new OperationError("SOURCE_FORMAT_MISSING", "production_clone_project로 확정된 원본 구성을 확인해 주세요. 기존 초안은 유지됩니다.");
  assertSourceStructure(snapshot.document, document);
}
