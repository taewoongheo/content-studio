import type { EditorDocument } from "../editor/types";
export type SlideshowStructure = "repeating" | "sequential";
export type EditorAsset = { id: string; name: string; type: "image/jpeg" | "image/png" | "image/webp"; size: number };
export type ContentJobInput = {
  structure: SlideshowStructure;
  aspectRatio: EditorDocument["aspectRatio"];
  slideCount: number;
  outputLanguage: string;
};
export type ContentJobRecord = ContentJobInput & {
  id: string;
  name?: string;
  savedRevision?: number;
  editor: { revision: number; document: EditorDocument };
  editorHistory: EditorDocument[];
  assets: EditorAsset[];
  createdAt: string;
  updatedAt: string;
};
export type ContentJobSnapshot = Omit<ContentJobRecord, "editorHistory">;
