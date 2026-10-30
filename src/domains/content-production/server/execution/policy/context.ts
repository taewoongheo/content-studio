import type { Row, WorkDetail } from "../../../domain/contracts";

const decisionFields = ["topic", "message", "answer", "content_type", "presentation", "sources"];
const progressFields = ["state", "content", "slide_plan", "content_review", "review", "sources", "remaining_actions"];
function pick(row: Row, fields: string[]): Row {
  return Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));
}
/** Decisions and repair evidence travel forward; comparison history stays in analysis. */
export function stageContext(detail: WorkDetail): WorkDetail {
  if (detail.task.current_step === "analysis") return detail;
  const result = {...detail, analysis:pick(detail.analysis, decisionFields), analysis_inputs:[]};
  for (const step of ["production", "hook", "polish", "visual"] as const) {
    const value = detail[step];
    if (value) result[step] = pick(value, progressFields);
  }
  return result;
}
