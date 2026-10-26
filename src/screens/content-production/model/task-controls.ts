import { productionSteps, type ProductionStep, type WorkItem } from "@/domains/content-production/domain/contracts";

export { productionSteps };

export type TaskControlAction = "stop" | "resume" | "delete_post";
export type TaskActionHandler = (id: string, action: TaskControlAction, step?: ProductionStep) => void;
export type StageControl = { action: TaskControlAction | null; disabled: boolean; onAction: () => void };

export function getStepState(task: WorkItem, step: ProductionStep) {
  const requested = productionSteps.findIndex(value => value.id === step);
  const current = productionSteps.findIndex(value => value.id === task.current_step);
  if (requested < current) return "completed";
  if (requested > current) return "pending";
  return task.state;
}

export function getPlaybackAction(task: WorkItem, step: ProductionStep): "stop" | "resume" | null {
  if (task.current_step !== step) return null;
  if (task.state === "pending" || task.state === "running") return "stop";
  if (task.state === "stopped" || task.state === "failed") return "resume";
  return null;
}

export function getTaskRemoval(task: WorkItem) {
  const hasFinishedPost = task.state === "finished" && !!task.project_id;
  return {
    action: hasFinishedPost ? "delete_post" : "remove",
    message: hasFinishedPost
      ? "포스트와 이미지, 제작 draft를 DB에서 삭제할까요? 되돌릴 수 없습니다."
      : "모든 단계 draft를 삭제할까요? 저장된 포스트는 유지됩니다.",
  };
}
