import type { WorkItem } from "./contracts";

export const OPEN_DRAFT_MESSAGE = "남은 draft를 게시하거나 삭제한 뒤 새로 시작해 주세요.";
export function getOpenDrafts(tasks: WorkItem[]) {
  return tasks;
}
export function hasOpenDrafts(tasks: WorkItem[]) {
  return tasks.length > 0;
}
