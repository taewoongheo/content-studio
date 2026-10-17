import type { SlideshowStructure } from "@/domains/slideshow/editor/types";
import type { EditorDocument } from "@/domains/slideshow/editor/types";

export type EditorAsset = { id: string; name: string; type: "image/jpeg" | "image/png" | "image/webp"; size: number };
export type ContentJobInput = {
  structure: SlideshowStructure;
  aspectRatio: EditorDocument["aspectRatio"];
  slideCount: number;
  outputLanguage: string;
};
export type ContentJobRecord = ContentJobInput & {
  id: string;
  tabId: string;
  name?: string;
  savedRevision?: number;
  saveError?: string;
  editor: { revision: number; document: EditorDocument };
  initialState: { name?: string; document: EditorDocument; outputLanguage: string };
  editorHistory: EditorDocument[];
  assets: EditorAsset[];
  imageData: Record<string, Uint8Array>;
  createdAt: string;
  updatedAt: string;
};
export type ContentJobSnapshot = Omit<ContentJobRecord, "editorHistory" | "initialState" | "imageData">;

