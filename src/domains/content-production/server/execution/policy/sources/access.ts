import { OperationError } from "@/lib/errors/operation";
import type { ProductionStep } from "../../../../domain/contracts";
import type { ProductionStore } from "../../../persistence/store";

export function assertSourceProjectAccess(store: ProductionStore, taskId: string, step: ProductionStep, projectId: string) {
  if ((step === "analysis" || step === "production") && !store.sourceProjectAllowed(taskId, projectId))
    throw new OperationError("ANALYSIS_SOURCE_NOT_ASSIGNED", "분석 자료 또는 선택한 원본 게시글만 확인할 수 있습니다.");
}
