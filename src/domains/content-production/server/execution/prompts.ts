import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProductionStep } from "../../domain/contracts";
const directionKeys = [
  "topic",
  "content_type",
  "message",
  "answer",
  "presentation",
  "reason",
  "expected_response",
  "goal_connection",
  "difference_from_recent",
];
const stringField = { type: "string" };
export function resultSchema(step: ProductionStep) {
  const properties =
    step === "analysis"
      ? Object.fromEntries(
          [...directionKeys, "analysis", "sources_json"].map((key) => [
            key,
            stringField,
          ]),
        )
      : {
          project_id: stringField,
          summary_json: stringField,
          sources_json: stringField,
          reviewed_slide_ids: { type: "array", items: stringField },
          reviewed_revision: { type: "integer" },
        };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
// Read on each execution so edits to the Markdown apply to the next CLI stage.
export function stagePrompt(taskId: string, step: ProductionStep) {
  const directory = join(process.cwd(), "docs", "production-prompts");
  const common = readFileSync(join(directory, "common.md"), "utf8").trim();
  const instructions = readFileSync(join(directory, `${step}.md`), "utf8").trim();
  return [
    `You are producing ONE LiftCode TikTok slideshow for task ${taskId}. Current stage: ${step}.`,
    common,
    instructions,
  ].join("\n\n");
}
