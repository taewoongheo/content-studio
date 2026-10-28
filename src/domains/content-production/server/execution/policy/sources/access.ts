import { OperationError } from "@/lib/errors/operation";
import type { ProductionStep } from "../../../../domain/contracts";
import type { ProductionStore } from "../../../persistence/store";

export function assertSourceProjectAccess(store: ProductionStore, taskId: string, step: ProductionStep, projectId: string) {
  if (step === "visual") {
    const input = store.get(taskId).input;
    if (input?.request.mode === "past_post" && input.source?.project_id === projectId) return;
    throw new OperationError("VISUAL_SOURCE_NOT_SELECTED", "시각 검수에서는 선택한 과거 원본만 확인할 수 있습니다.");
  }
  if ((step === "analysis" || step === "production") && !store.sourceProjectAllowed(taskId, projectId))
    throw new OperationError("ANALYSIS_SOURCE_NOT_ASSIGNED", "분석 자료 또는 선택한 원본 게시글만 확인할 수 있습니다.");
}
