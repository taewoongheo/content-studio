import { BACKGROUND_ELEMENT_ID, ensureSharedBackground, validateEditorDocument } from "../document";
import type { SlideshowStructure } from "../../domain/types";
import type { EditorDocument, EditorSlide, ElementDefinition, ElementFrame, ElementStyle, PlacedElement, SlideRole } from "../types";
export type FixtureLayout = {
  elements: ElementDefinition[];
  slides: Array<{ imageId: string; role: SlideRole; backgroundColor: string; elementIds: string[];
    visuals: Array<{ elementId: string; frame: ElementFrame; style: ElementStyle }> }>;
};
export function createTestDocument(
  analysis: FixtureLayout,
  structure: SlideshowStructure,
  slideCount: number,
  aspectRatio: EditorDocument["aspectRatio"],
): EditorDocument {
  if (analysis.slides.length !== slideCount)
    throw new Error("레퍼런스 분석의 슬라이드 수가 입력과 일치하지 않습니다.");
  if (structure === "repeating" && analysis.slides.some((slide, index) =>
    slide.role !== (index === 0 ? "hook" : index === slideCount - 1 ? "cta" : "body")))
    throw new Error("반복형 레퍼런스의 역할 순서가 올바르지 않습니다.");
  const knownElements = new Set(analysis.elements.map((element) => element.id));
  if (analysis.slides.some((slide) => slide.elementIds.some((id) => !knownElements.has(id))))
    throw new Error("존재하지 않는 Element를 참조합니다.");
  if (knownElements.has(BACKGROUND_ELEMENT_ID)) throw new Error("예약된 배경 Element ID입니다.");
  const makeSlide = (source: FixtureLayout["slides"][number], index: number): EditorSlide => ({
    id: `slide-${index + 1}`,
    role: source.role,
    backgroundColor: source.backgroundColor,
    placements: source.elementIds.map((elementId, placementIndex): PlacedElement => {
      const visual = source.visuals.find((item) => item.elementId === elementId);
      return {
        id: `placement-${index + 1}-${placementIndex + 1}`,
        elementId,
        value: "",
        frameOverride: visual?.frame ?? null,
        styleOverride: visual?.style ?? null,
      };
    }),
  });
  const slides = analysis.slides.map(makeSlide);
  const document: EditorDocument = {
    version: 1,
    structure,
    aspectRatio,
    elements: structuredClone(analysis.elements),
    slides,
  };
  ensureSharedBackground(document);
  const errors = validateEditorDocument(document);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return document;
}
