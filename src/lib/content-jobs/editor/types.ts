import type { SlideshowStructure } from "../domain/types";
import type { EditorFontFamily } from "./typography/fonts";

// Normalized document coordinates still allow elements far outside the slide.
export const MAX_FRAME_COORDINATE = 10;
export const MAX_FRAME_DIMENSION = 20;

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
  fontStyle?: "normal" | "italic";
  textAlign: "left" | "center" | "right";
  borderRadius: number;
  borderEnabled?: boolean;
  borderColor?: string;
  borderWidth?: number;
  fontFamily: EditorFontFamily;
  imageFit: "cover" | "contain";
};
export type ElementDefinition = {
  id: string;
  name: string;
  role: string;
  kind: ElementKind;
  frame: ElementFrame;
  style: ElementStyle;
};
export type PlacedElement = {
  id: string;
  elementId: string;
  value: string;
  textColors?: TextColorRange[];
  frameOverride: ElementFrame | null;
  styleOverride: Partial<ElementStyle> | null;
};
export type TextColorRange = { start: number; end: number; color: string };
export type EditorSlide = {
  id: string;
  name?: string;
  role: SlideRole;
  backgroundColor: string;
  placements: PlacedElement[];
};
export type EditorDocument = {
  version: 1;
  structure: SlideshowStructure;
  aspectRatio: "4:5" | "1:1" | "9:16";
  elements: ElementDefinition[];
  slides: EditorSlide[];
};
export type EditorCommand =
  | { type: "set_aspect_ratio"; aspectRatio: EditorDocument["aspectRatio"] }
  | { type: "reorder_slides"; slideIds: string[] }
  | { type: "rename_slide"; slideId: string; name: string }
  | { type: "reorder_layers"; slideId: string; placementIds: string[] }
  | { type: "set_slide_background"; slideId: string; color: string }
  | { type: "set_slot_value"; slideId: string; placementId: string; value: string; textColors?: TextColorRange[] }
  | { type: "set_text_colors"; slideId: string; placementId: string; textColors: TextColorRange[] }
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
