import { preservesSourceFormat } from "../../../domain/start/input";
import type { Row, WorkDetail } from "../../../domain/contracts";

const CONTENT_FIELDS = ["title", "topic", "message", "content_type", "hook", "caption", "hashtags"];
const SLIDE_COPY_FIELDS = ["slide_id", "role", "copy"];
const LOG_FIELDS = ["id", "topic", "message", "content_type"];

function pickFields(row: Row, fields: readonly string[]): Row {
  return Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));
}

/** Keep authored copy without earlier layout descriptions, changes or reference provenance. */
function currentCopy(value: unknown): Row {
  const content = value && typeof value === "object" ? value as Row : {};
  const slides = Array.isArray(content.slides) ? content.slides : [];
  return {
    ...pickFields(content, CONTENT_FIELDS),
    slides: slides.map(slide => pickFields(slide as Row, SLIDE_COPY_FIELDS)),
  };
}

/** Visual review sees current content only, never clone identity or earlier reference analysis. */
export function stageContext(detail: WorkDetail): WorkDetail {
  if (detail.task.current_step !== "visual") return detail;

  const content = currentCopy(detail.polish?.content ?? detail.log.content_summary);
  return {
    task: detail.task,
    ...(detail.input && preservesSourceFormat(detail.input.request.mode) ? { input: detail.input } : {}),
    analysis: detail.input && preservesSourceFormat(detail.input.request.mode)
      ? pickFields(detail.analysis, ["presentation", "content_type"]) : {},
    production: null,
    hook: null,
    analysis_inputs: [],
    external: {},
    log: { ...pickFields(detail.log, LOG_FIELDS), content_summary: content },
    polish: { content },
    visual: detail.visual
      ? { state: detail.visual.state, content: currentCopy(detail.visual.content) }
      : null,
  };
}
