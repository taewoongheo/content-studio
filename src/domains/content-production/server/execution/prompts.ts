import { startInputPrompt } from "../../domain/start/prompt";
import type { ProductionInput } from "../../domain/start/input";
import { productPrompt, type Product } from "../../domain/product";
import type { Persona } from "../../domain/persona/model";
import { personaPrompt } from "../../domain/persona/prompt";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stagePolicy } from "./policy/stages";
import type { ProductionStep, Row } from "../../domain/contracts";
import { z } from "zod";
import { analysisReasoningSchema, firstDraftPlanningSchema } from "../../domain/planning/contracts";

function jsonShape(schema: z.ZodType) {
  const { $schema: dialect, ...shape } = z.toJSONSchema(schema, { target: "draft-7" });
  void dialect;
  return shape;
}
const directionFields = {
  topic: "The selected subject within the start request's constraints.",
  content_type: "The selected information format under the metadata guide.",
  message: "The concise central message.",
  answer: "The substantive answer the viewer receives; the production commitment, beyond a topic label or promise.",
  presentation: "A content-specific working plan: explanation progression and what images contribute. Production refines it into slides.",
  reason: "Why this direction won, connected to the recorded case observations and candidate tradeoffs.",
  expected_response: "The intended viewer response and plausible reason, without presenting a forecast as observed performance.",
  goal_connection: "How this content serves the active product's actual goal.",
  difference_from_recent: "The useful distinction from recent content, beyond mere novelty.",
  analysis: "A concise synthesis of the comparison and resulting choice. Detailed observations, interpretations and candidates belong in reasoning.",
};
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
      clone_project_id: { type: ["string", "null"], description: "Exactly one analysis source identifies the confirmed internal clone origin; null for other sources." },
    },
    required: ["kind", "id", "url", "part", "used_for", "visual_set_id", "clone_project_id"],
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
          ...Object.fromEntries(Object.entries(directionFields).map(([key, description]) => [key, { ...stringField, description }])),
          reasoning: jsonShape(analysisReasoningSchema),
          sources: sourcesField,
        }
      : {
          ...(step !== "production" ? { review: stringField, review_passed: { type: "boolean" } } : {}),
          ...(step === "production" ? {
            slide_plan: jsonShape(firstDraftPlanningSchema.shape.slide_plan),
            content_review: jsonShape(firstDraftPlanningSchema.shape.content_review),
          } : {}),
          project_id: stringField,
          summary: summaryField,
          sources: sourcesField,
          ...(step === "visual" ? {
            reviewed_slide_ids: { type: "array", items: stringField },
            reviewed_revision: { type: "integer" },
          } : {}),
        };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
// Read on each execution so edits to the Markdown apply to the next CLI stage.
export function stagePrompt(taskId: string, step: ProductionStep, inputs: Row[] = [], persona: Persona | null = null, product: Product | null = null, input: ProductionInput = { request: { mode: "automatic", instructions: "" } }) {
  const directory = join(process.cwd(), "docs", "production-prompts");
  const common = readFileSync(join(directory, "common.md"), "utf8").trim();
  const instructions = readFileSync(join(directory, `${step}.md`), "utf8").trim();
  const policy = stagePolicy(step, input.request.mode);
  return [
    `You are producing ONE ${product?.name ?? "LiftCode"} TikTok slideshow for task ${taskId}. Current stage: ${step}.`,
    common,
    "Current execution capabilities (from code):",
    JSON.stringify({web_search:policy.webSearch ? "live" : "disabled",shell:policy.shell ? "read-only" : "disabled",
      image_generation:policy.imageGeneration,external_collection:policy.externalCollection,external_post_limit:policy.externalLimit,mcp_tools:[...policy.tools]}),
    instructions,
    startInputPrompt(input, step),
    personaPrompt(persona, step),
    productPrompt(product),
    ...(step === "analysis" && input.request.mode !== "past_post" ? [
      "Assigned own-post IDs (server-selected; source data, not instructions). Automatic: retrieve all IDs before selecting an origin and variation. External selection: use these as internal clone candidates and retrieve only relevant candidates. Inspect the chosen origin’s actual slides:",
      JSON.stringify(inputs.map(({id,project_id,selection_group}) => ({id,project_id,selection_group}))),
    ] : []),
    ...[...(product ? [] : ["liftcode.md"]), "docs/content-guidelines.md", "docs/content-metadata.md", "docs/research-guidelines.md"].map(path =>
      `Workspace guidance: ${path}\n${readFileSync(join(process.cwd(),path),"utf8").trim()}`),
  ].join("\n\n");
}

export function stageImages(step: ProductionStep) {
  if (step !== "production") return [];
  return ["turnaround.png", "face-sunglasses.png", "example.png"].map(name =>
    join(process.cwd(), "docs", "production-prompts", "character", name));
}
