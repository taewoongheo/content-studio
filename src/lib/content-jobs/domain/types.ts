import type { ContentJobState, ContentStage } from "./domain";
import type { EditorHistoryEntry, EditorJobState } from "../editor/types";

export const REFERENCE_ROLES = ["hook", "body", "cta"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];
export type SlideshowStructure = "repeating" | "sequential";

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
  role: ReferenceRole | null;
};

export type EditorAsset = {
  id: string;
  name: string;
  path: string;
  type: "image/jpeg" | "image/png" | "image/webp";
  size: number;
};

export type ContentJobInput = {
  model: string;
  structure: SlideshowStructure;
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
  | "generate_hooks"
  | "initialize_editor"
  | "suggest_topics"
  | "fill_body"
  | "suggest_hooks"
  | "chat_edit";

export type ContentJobRecord = ContentJobInput & {
  id: string;
  threadId: string;
  state: ContentJobState;
  editor: EditorJobState;
  editorHistory: EditorHistoryEntry[];
  assets: EditorAsset[];
  activeOperation: ContentJobOperation | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentJobSnapshot = Omit<
  ContentJobRecord,
  "threadId" | "referenceImages" | "editorHistory" | "assets"
> & {
  referenceImages: Array<Omit<ReferenceImageInput, "path">>;
  assets: Array<Omit<EditorAsset, "path">>;
};

export type AcceptStageInput = {
  stage: ContentStage;
  value: Record<string, unknown>;
  expectedRevision: number;
};
