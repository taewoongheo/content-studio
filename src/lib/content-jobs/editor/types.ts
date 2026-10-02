import type { SlideshowStructure } from "../domain/types";

export type SlideRole = "hook" | "body" | "cta";
export type ElementKind = "background" | "text" | "image" | "rectangle" | "circle" | "triangle";
export type ElementFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ElementStyle = {
  color: string;
  backgroundColor: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: number;
  textAlign: "left" | "center" | "right";
  borderRadius: number;
  fontFamily: "sans-serif" | "serif" | "monospace";
  imageFit: "cover" | "contain";
};
export type ElementDefinition = {
  id: string;
  name: string;
  role: string;
  kind: ElementKind;
  frame: ElementFrame;
  style: ElementStyle;
  sourceImageId: string;
};
export type PlacedElement = {
  id: string;
  elementId: string;
  value: string;
  frameOverride: ElementFrame | null;
  styleOverride: Partial<ElementStyle> | null;
};
export type EditorSlide = {
  id: string;
  name?: string;
  role: SlideRole;
  backgroundColor: string;
  placements: PlacedElement[];
};
export type EditorFormatNotes = {
  visualRules: string;
  writingStyle: string;
  hookPattern: string;
  bodyProgression: string;
};
export type EditorDocument = {
  version: 1;
  structure: SlideshowStructure;
  aspectRatio: "4:5" | "1:1" | "9:16";
  formatNotes: EditorFormatNotes;
  elements: ElementDefinition[];
  slides: EditorSlide[];
};
export type EditorTopic = {
  id: string;
  title: string;
  angle: string;
  rationale: string;
  sourceUrls: string[];
};
export type EditorHook = { id: string; text: string; rationale: string };
export type EditorProposalSet =
  | { id: string; kind: "topic"; version: number; messageId: string; stale: boolean; consumed?: boolean; items: EditorTopic[] }
  | { id: string; kind: "hook"; version: number; messageId: string; stale: boolean; consumed?: boolean; items: EditorHook[] };
export type EditorExecutionStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
};
export type EditorProposalTarget = { setId: string; candidateId: string };
export type EditorChatTarget = {
  slideId: string;
  placementId: string;
  elementId: string;
  slideIds: string[];
};
export type EditorMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: Array<{ id: string; name: string; type: "image/jpeg" | "image/png" | "image/webp" }>;
  image?: { id: string; name: string; type: "image/jpeg" | "image/png" | "image/webp" };
  target?: EditorChatTarget;
  proposalTarget?: EditorProposalTarget;
  proposalLabel?: string;
  execution?: { steps: EditorExecutionStep[]; error?: string };
};
export type EditorJobState = {
  status: "pending" | "analyzing" | "ready";
  revision: number;
  document: EditorDocument | null;
  messages: EditorMessage[];
  topicSuggestions: EditorTopic[];
  proposalSets: EditorProposalSet[];
  selectedTopic: EditorTopic | null;
  bodyReady: boolean;
  hookSuggestions: EditorHook[];
  selectedHookId: string | null;
};
export type EditorHistoryEntry = Pick<
  EditorJobState,
  "document" | "selectedTopic" | "bodyReady" | "hookSuggestions" | "selectedHookId" | "proposalSets"
>;
export type EditorAnalysis = {
  formatNotes: EditorDocument["formatNotes"];
  elements: ElementDefinition[];
  slides: Array<{
    imageId: string;
    role: SlideRole;
    backgroundColor: string;
    elementIds: string[];
    visuals: Array<{ elementId: string; frame: ElementFrame; style: ElementStyle }>;
  }>;
};

export type EditorCommand =
  | { type: "reorder_slides"; slideIds: string[] }
  | { type: "rename_slide"; slideId: string; name: string }
  | { type: "reorder_layers"; slideId: string; placementIds: string[] }
  | { type: "set_slide_background"; slideId: string; color: string }
  | { type: "set_slot_value"; slideId: string; placementId: string; value: string }
  | { type: "update_visual"; scope: "common"; elementId: string; frame?: ElementFrame; style?: Partial<ElementStyle> }
  | { type: "update_visual"; scope: "local"; slideId: string; placementId: string; frame?: ElementFrame; style?: Partial<ElementStyle> }
  | { type: "update_element"; elementId: string; name?: string; role?: string }
  | { type: "add_element"; element: ElementDefinition }
  | { type: "place_element"; slideId: string; elementId: string; placementId: string }
  | { type: "add_slide"; afterSlideId: string; sourceSlideId: string; newSlideId: string; copyContent: boolean }
  | { type: "remove_slide"; slideId: string }
  | { type: "remove_placement"; slideId: string; placementId: string }
  | { type: "duplicate_placement"; sourceSlideId: string; sourcePlacementId: string;
      newElementId: string; placements: Array<{ slideId: string; sourcePlacementId: string; newPlacementId: string }> };
