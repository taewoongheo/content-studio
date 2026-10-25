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
const sourcesField = {
  type: "array",
  items: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["log", "reference", "url"] },
      id: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      part: { type: "string", description: "The specific part of the source that was referenced." },
      used_for: { type: "string", description: "How this source informed the current content." },
      visual_set_id: { type: ["string", "null"] },
    },
    required: ["kind", "id", "url", "part", "used_for", "visual_set_id"],
    additionalProperties: false,
  },
};
const summaryField = {
  type: "object",
  properties: {
    title: stringField,
    topic: stringField,
    message: stringField,
    content_type: stringField,
    hook: stringField,
    caption: stringField,
    hashtags: { type: "array", items: stringField },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slide_id: stringField,
          role: { type: "string", enum: ["hook", "body", "cta"] },
          copy: { type: "array", items: stringField },
          visual: stringField,
        },
        required: ["slide_id", "role", "copy", "visual"],
        additionalProperties: false,
      },
    },
    changes: { type: "array", items: stringField },
  },
  required: ["title", "topic", "message", "content_type", "hook", "caption", "hashtags", "slides", "changes"],
  additionalProperties: false,
};
export function resultSchema(step: ProductionStep) {
  const properties =
    step === "analysis"
      ? {
          ...Object.fromEntries([...directionKeys, "analysis"].map(key => [key, stringField])),
          sources: sourcesField,
        }
      : {
          ...(step === "hook" || step === "visual" ? { review: stringField, review_passed: { type: "boolean" } } : {}),
          project_id: stringField,
          summary: summaryField,
          sources: sourcesField,
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

export function stageImages(step: ProductionStep) {
  if (step !== "production") return [];
  return ["turnaround.png", "face-sunglasses.png", "example.png"].map(name =>
    join(process.cwd(), "docs", "production-prompts", "character", name));
}
