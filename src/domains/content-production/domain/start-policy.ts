import type { Row, WorkItem } from "./contracts";

export const OPEN_DRAFT_MESSAGE = "남은 제작을 마무리하거나 취소·제거한 뒤 새로 시작해 주세요.";
export function getOpenDrafts(tasks: WorkItem[], logs: Row[]) {
  const completed = new Set(logs.filter(log => log.completed_at).map(log => log.id));
  return tasks.filter(task => !completed.has(task.log_id));
}

export function hasOpenDrafts(tasks: WorkItem[], logs: Row[]) {
  return getOpenDrafts(tasks, logs).length > 0;
}
