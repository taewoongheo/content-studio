import Ajv, { type ErrorObject } from "ajv";

export type StructuredOutputSchema = Record<string, unknown>;
export type StructuredOutputValidation<Value = unknown> =
  | { ok: true; value: Value }
  | { ok: false; errors: string[] };

export type ReferenceAnalysisOutput = {
  sourceLanguage: string;
  outputLanguage: string;
  visualLanguage: { summary: string; imageIds: string[] };
  slides: Array<{
    imageId: string;
    role: string;
    transitionFromPrevious: string;
  }>;
  writingStyle: { summary: string; imageIds: string[] };
  textDensity: { summary: string; imageIds: string[] };
  hook: { originalText: string; pattern: string; imageIds: string[] };
  uncertainties: string[];
};

export type StrategyOutput = {
  evidence: Array<{ id: string; url: string; title: string; summary: string }>;
  strategies: Array<{
    id: string;
    topic: string;
    angle: string;
    referenceFit: string;
    slidePlan: Array<{
      id: string;
      role: string;
      productFact: string;
      evidenceIds: string[];
    }>;
    warnings: string[];
  }>;
  missingInformation: string[];
};

export type CopyOutput = {
  slides: Array<{
    id: string;
    role: string;
    headline: string;
    body: string;
    visualDirection: string;
    transitionFromPrevious: string;
    claimReferences: string[];
  }>;
  uncertainties: string[];
};

export type HookOutput = {
  hooks: Array<{
    id: string;
    text: string;
    pattern: string;
    angle: string;
    supportingSlideIds: string[];
  }>;
  warnings: string[];
};

const stringSchema = { type: "string" } as const;
const stringArraySchema = {
  type: "array",
  items: stringSchema,
} as const;

function objectSchema(
  properties: Record<string, unknown>,
): StructuredOutputSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function exactArray(items: unknown, count: number) {
  return { type: "array", items, minItems: count, maxItems: count };
}

const referenceSlideSchema = objectSchema({
  imageId: stringSchema,
  role: stringSchema,
  transitionFromPrevious: stringSchema,
});

export const referenceAnalysisSchema = objectSchema({
  sourceLanguage: stringSchema,
  outputLanguage: stringSchema,
  visualLanguage: objectSchema({
    summary: stringSchema,
    imageIds: stringArraySchema,
  }),
  slides: { type: "array", items: referenceSlideSchema, minItems: 1 },
  writingStyle: objectSchema({
    summary: stringSchema,
    imageIds: stringArraySchema,
  }),
  textDensity: objectSchema({
    summary: stringSchema,
    imageIds: stringArraySchema,
  }),
  hook: objectSchema({
    originalText: stringSchema,
    pattern: stringSchema,
    imageIds: stringArraySchema,
  }),
  uncertainties: stringArraySchema,
});

const evidenceSchema = objectSchema({
  id: stringSchema,
  url: stringSchema,
  title: stringSchema,
  summary: stringSchema,
});

const strategySlideSchema = objectSchema({
  id: stringSchema,
  role: stringSchema,
  productFact: stringSchema,
  evidenceIds: stringArraySchema,
});

export function strategySchema(slideCount: number): StructuredOutputSchema {
  const strategyItemSchema = objectSchema({
    id: stringSchema,
    topic: stringSchema,
    angle: stringSchema,
    referenceFit: stringSchema,
    slidePlan: exactArray(strategySlideSchema, slideCount),
    warnings: stringArraySchema,
  });
  return objectSchema({
    evidence: { type: "array", items: evidenceSchema },
    strategies: exactArray(strategyItemSchema, 3),
    missingInformation: stringArraySchema,
  });
}

const copySlideSchema = objectSchema({
  id: stringSchema,
  role: stringSchema,
  headline: stringSchema,
  body: stringSchema,
  visualDirection: stringSchema,
  transitionFromPrevious: stringSchema,
  claimReferences: stringArraySchema,
});

export function copySchema(slideCount: number): StructuredOutputSchema {
  return objectSchema({
    slides: exactArray(copySlideSchema, slideCount),
    uncertainties: stringArraySchema,
  });
}

const hookItemSchema = objectSchema({
  id: stringSchema,
  text: stringSchema,
  pattern: stringSchema,
  angle: stringSchema,
  supportingSlideIds: stringArraySchema,
});

export const hookSchema = objectSchema({
  hooks: exactArray(hookItemSchema, 4),
  warnings: stringArraySchema,
});

const ajv = new Ajv({ allErrors: true, strict: true });

function formatError(error: ErrorObject) {
  const path = error.instancePath || "/";
  return `${path}: ${error.message ?? "유효하지 않은 값입니다."}`;
}

export function validateStructuredOutput<Value = unknown>(
  schema: StructuredOutputSchema,
  value: unknown,
): StructuredOutputValidation<Value> {
  const validate = ajv.compile(schema);
  if (validate(value)) return { ok: true, value: value as Value };
  return { ok: false, errors: (validate.errors ?? []).map(formatError) };
}
