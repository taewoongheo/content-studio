import type { ContentJobState, ContentStage } from "./domain";

export type ProductContextInput = {
  name: string;
  description: string;
  audience: string;
  constraints: string;
};

export type ReferenceImageInput = {
  id: string;
  name: string;
  path: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  size: number;
};

export type ContentJobInput = {
  productContext: ProductContextInput;
  aspectRatio: "4:5" | "1:1" | "9:16";
  slideCount: number;
  outputLanguage: string;
  referenceImages: ReferenceImageInput[];
};

export type ContentJobOperation =
  | "analyze_reference"
  | "generate_strategies"
  | "generate_copy"
  | "generate_hooks";

export type ContentJobRecord = ContentJobInput & {
  id: string;
  threadId: string;
  state: ContentJobState;
  activeOperation: ContentJobOperation | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentJobSnapshot = Omit<
  ContentJobRecord,
  "threadId" | "referenceImages"
> & {
  referenceImages: Array<Omit<ReferenceImageInput, "path">>;
};

export type AcceptStageInput = {
  stage: ContentStage;
  value: Record<string, unknown>;
  expectedRevision: number;
};
