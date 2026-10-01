import { editorCommandsSchema } from "../../schema";
import type { EditorCommand, EditorHook, EditorTopic } from "../../types";
import { hookSuggestionsSchema, topicSuggestionsSchema } from "../schemas";

export type AgentReadAction =
  | { id: string; type: "search_assets"; queries: string[] }
  | { id: string; type: "inspect_assets"; assetIds: string[] };

export type AgentOutput = {
  status: "actions" | "complete" | "ask_user";
  reply: string;
  actions: AgentReadAction[];
  topics: EditorTopic[];
  hooks: EditorHook[];
  appliedProposalId: string;
  history: "none" | "undo";
  commands: EditorCommand[];
};

export type AgentActionResult = {
  actionId: string;
  type: AgentReadAction["type"];
  result: unknown;
};

const text = { type: "string" };

export const objectSchema = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

/** Codex strict schemas require every property; optional command patches use null and are stripped on receipt. */
function strictSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictSchema);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(source)) {
    if (key === "minProperties") continue;
    result[key === "oneOf" ? "anyOf" : key] = strictSchema(field);
  }
  if (typeof source.const === "string") result.type = "string";
  if (source.type === "object" && source.properties) {
    const required = new Set(source.required as string[]);
    result.properties = Object.fromEntries(Object.entries(source.properties).map(([key, schema]) =>
      [key, required.has(key) ? strictSchema(schema) : { anyOf: [strictSchema(schema), { type: "null" }] }]));
    result.required = Object.keys(source.properties);
  }
  return result;
}

export function stripNullPatches(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullPatches);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null)
    .map(([key, entry]) => [key, stripNullPatches(entry)]));
}

const readActionSchema = {
  anyOf: [
    objectSchema({ id: text, type: { type: "string", const: "search_assets" }, queries: {
      type: "array", items: { type: "string", minLength: 1, maxLength: 240 }, minItems: 1, maxItems: 8,
    } }),
    objectSchema({ id: text, type: { type: "string", const: "inspect_assets" }, assetIds: {
      type: "array", items: text, minItems: 1, maxItems: 4,
    } }),
  ],
};

const topicItems = topicSuggestionsSchema.properties.topics as Record<string, unknown>;
const hookItems = hookSuggestionsSchema.properties.hooks as Record<string, unknown>;

export const agentOutputSchema = objectSchema({
  status: { type: "string", enum: ["actions", "complete", "ask_user"] },
  reply: text,
  actions: { type: "array", items: readActionSchema, maxItems: 8 },
  topics: { ...topicItems, minItems: 0, maxItems: 8 },
  hooks: { ...hookItems, minItems: 0, maxItems: 8 },
  appliedProposalId: text,
  history: { type: "string", enum: ["none", "undo"] },
  commands: strictSchema(editorCommandsSchema.properties.commands),
});
